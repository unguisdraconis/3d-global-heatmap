"""Build the complete validated TEMPERIES 2025 dataset from real daily sources."""

from __future__ import annotations

import argparse
import os
import shutil
import warnings
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Any

import numpy as np
from netCDF4 import Dataset, num2date

from common import (
    GRID_HEIGHT,
    GRID_WIDTH,
    align_oisst_to_canonical,
    as_float_with_nan,
    bilinear_to_canonical,
    dates_in_year,
    decode_temperature_field,
    encode_temperature_field,
    sha256_file,
    weekly_periods,
    write_json,
)

YEAR = 2025
PROJECT_ROOT = Path(__file__).resolve().parents[2]
RAW_ROOT = PROJECT_ROOT / "untouched_data" / str(YEAR) / "annual"
OUTPUT_ROOT = PROJECT_ROOT / "validation_data" / str(YEAR) / "annual"
PREVIEW_ROOT = PROJECT_ROOT / "public" / "real-2025" / "data" / str(YEAR)
SYNTHETIC_ARCHIVE = PROJECT_ROOT / "public" / "synthetic" / "data" / str(YEAR)
LEGACY_MASK_PATH = PROJECT_ROOT / "public" / "data" / str(YEAR) / "land-mask.bin"
EXPECTED_RASTER_BYTES = GRID_WIDTH * GRID_HEIGHT * 2
EXPECTED_MASK_BYTES = GRID_WIDTH * GRID_HEIGHT
HISTOGRAM_MINIMUM = -80.0
HISTOGRAM_MAXIMUM = 60.0
HISTOGRAM_BIN_WIDTH = 0.5
HISTOGRAM_BIN_COUNT = 280


def finite_mean(stack: np.ndarray) -> np.ndarray:
    valid = np.isfinite(stack)
    count = valid.sum(axis=0)
    total = np.where(valid, stack, 0.0).sum(axis=0)
    result = np.full(count.shape, np.nan, dtype=np.float64)
    np.divide(total, count, out=result, where=count > 0)
    return result


def coordinate(dataset: Dataset, names: tuple[str, ...]) -> np.ndarray:
    for name in names:
        if name in dataset.variables:
            return np.asarray(dataset.variables[name][:], dtype=np.float64)
    raise ValueError(f"Could not find any coordinate named {names}")


def temperature_variable(dataset: Dataset):
    for name in ("t2m", "2m_temperature"):
        if name in dataset.variables:
            return dataset.variables[name]
    for variable in dataset.variables.values():
        if getattr(variable, "standard_name", "") == "air_temperature" and variable.ndim >= 2:
            return variable
    raise ValueError("Could not find ERA5 2 m temperature")


def oisst_path(current: date) -> Path:
    stamp = current.strftime("%Y%m%d")
    return RAW_ROOT / "oisst" / current.strftime("%Y%m") / f"oisst-avhrr-v02r01.{stamp}.nc"


def load_oisst_period(
    period: tuple[date, ...], baseline_ocean: np.ndarray | None
) -> tuple[np.ndarray, np.ndarray]:
    days: list[np.ndarray] = []
    baseline = baseline_ocean
    for current in period:
        path = oisst_path(current)
        if not path.is_file():
            raise FileNotFoundError(f"Missing OISST source for {current}: {path}")
        with Dataset(path) as dataset:
            aligned = align_oisst_to_canonical(
                np.ma.squeeze(dataset.variables["sst"][:]),
                coordinate(dataset, ("lat", "latitude")),
                coordinate(dataset, ("lon", "longitude")),
            )
        ocean = np.isfinite(aligned)
        if baseline is None:
            baseline = ocean
        elif not np.array_equal(ocean, baseline):
            changed = int(np.count_nonzero(ocean != baseline))
            raise ValueError(f"OISST support changed on {current} in {changed} cells")
        days.append(aligned)
    if baseline is None:
        raise ValueError("OISST period is empty")
    weekly = finite_mean(np.stack(days))
    if not np.isfinite(weekly[baseline]).all():
        raise ValueError(f"OISST weekly mean has gaps during {period[0]}–{period[-1]}")
    return weekly, baseline


def build_era_index() -> tuple[dict[date, tuple[Path, int]], np.ndarray, np.ndarray]:
    files = sorted((RAW_ROOT / "era5").glob("era5-2m-temperature-daily-mean-*.nc"))
    if len(files) != 12:
        raise FileNotFoundError(f"Expected 12 ERA5 monthly files; found {len(files)}")
    index: dict[date, tuple[Path, int]] = {}
    canonical_lat: np.ndarray | None = None
    canonical_lon: np.ndarray | None = None
    for path in files:
        with Dataset(path) as dataset:
            variable = temperature_variable(dataset)
            time_variable = dataset.variables[variable.dimensions[0]]
            timestamps = num2date(
                time_variable[:],
                units=time_variable.units,
                calendar=getattr(time_variable, "calendar", "standard"),
                only_use_cftime_datetimes=False,
                only_use_python_datetimes=True,
            )
            lat = coordinate(dataset, ("latitude", "lat"))
            lon = coordinate(dataset, ("longitude", "lon"))
            if canonical_lat is None:
                canonical_lat, canonical_lon = lat, lon
            elif not np.array_equal(lat, canonical_lat) or not np.array_equal(lon, canonical_lon):
                raise ValueError(f"ERA5 grid changed in {path.name}")
            for position, timestamp in enumerate(timestamps):
                current = date(timestamp.year, timestamp.month, timestamp.day)
                if current in index:
                    raise ValueError(f"Duplicate ERA5 daily mean for {current}")
                index[current] = (path, position)
    expected = set(dates_in_year(YEAR))
    if set(index) != expected:
        missing = sorted(expected - set(index))
        extra = sorted(set(index) - expected)
        raise ValueError(f"ERA5 date coverage mismatch; missing={missing[:3]}, extra={extra[:3]}")
    if canonical_lat is None or canonical_lon is None:
        raise ValueError("ERA5 index is empty")
    return index, canonical_lat, canonical_lon


def load_era_period(
    period: tuple[date, ...],
    index: dict[date, tuple[Path, int]],
    latitudes: np.ndarray,
    longitudes: np.ndarray,
) -> np.ndarray:
    grouped: dict[Path, list[tuple[date, int]]] = defaultdict(list)
    for current in period:
        grouped[index[current][0]].append((current, index[current][1]))
    values: dict[date, np.ndarray] = {}
    units: set[str] = set()
    for path, positions in grouped.items():
        with Dataset(path) as dataset:
            variable = temperature_variable(dataset)
            units.add(str(getattr(variable, "units", "unknown")))
            for current, position in positions:
                values[current] = as_float_with_nan(variable[position, :, :])
    weekly = finite_mean(np.stack([values[current] for current in period]))
    if units == {"K"} or np.nanmedian(weekly) > 100.0:
        weekly = weekly - 273.15
    canonical = bilinear_to_canonical(weekly, latitudes, longitudes)
    if not np.isfinite(canonical).all():
        raise ValueError(f"ERA5 weekly mean has gaps during {period[0]}–{period[-1]}")
    return canonical


def atomic_array_write(path: Path, values: np.ndarray, expected_bytes: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".part")
    values.tofile(temporary)
    if temporary.stat().st_size != expected_bytes:
        raise ValueError(f"{path.name} has {temporary.stat().st_size} bytes, expected {expected_bytes}")
    os.replace(temporary, path)


def rounded_histogram(values: np.ndarray, valid: np.ndarray) -> tuple[list[float], float]:
    row_weights = np.cos(np.deg2rad(89.875 - np.arange(GRID_HEIGHT) * 0.25))
    weights = np.broadcast_to(row_weights[:, None], values.shape)
    finite = np.isfinite(values)
    bins = np.full(values.shape, -1, dtype=np.int32)
    bins[finite] = np.floor((values[finite] - HISTOGRAM_MINIMUM) / HISTOGRAM_BIN_WIDTH).astype(np.int32)
    included = valid & finite & (bins >= 0) & (bins < HISTOGRAM_BIN_COUNT)
    histogram = np.bincount(bins[included], weights=weights[included], minlength=HISTOGRAM_BIN_COUNT)[:HISTOGRAM_BIN_COUNT]
    return [round(float(value), 3) for value in histogram], round(float(weights[valid].sum()), 3)


def frame_metadata(
    frame_index: int,
    period: tuple[date, ...],
    surface_mask: np.ndarray,
    air_encoded: np.ndarray,
    sst_encoded: np.ndarray,
) -> dict[str, Any]:
    air = decode_temperature_field(air_encoded)
    sst = decode_temperature_field(sst_encoded)
    air_valid = surface_mask == 1
    ocean_valid = surface_mask == 0
    land_histogram, land_area = rounded_histogram(air, air_valid)
    ocean_histogram, ocean_area = rounded_histogram(sst, ocean_valid)
    combined_histogram = [round(land + ocean, 3) for land, ocean in zip(land_histogram, ocean_histogram, strict=True)]
    land_minimum = round(float(np.nanmin(air[air_valid])), 2)
    land_maximum = round(float(np.nanmax(air[air_valid])), 2)
    ocean_minimum = round(float(np.nanmin(sst[ocean_valid])), 2)
    ocean_maximum = round(float(np.nanmax(sst[ocean_valid])), 2)
    frame_id = f"week-{frame_index:02d}"
    return {
        "id": frame_id,
        "frame": frame_index,
        "startDate": period[0].isoformat(),
        "endDate": period[-1].isoformat(),
        "representativeDate": period[(len(period) - 1) // 2].isoformat(),
        "observations": len(period),
        "air": f"air/{frame_id}.bin",
        "sst": f"sst/{frame_id}.bin",
        "minimums": {"land": land_minimum, "ocean": ocean_minimum, "combined": min(land_minimum, ocean_minimum)},
        "maximums": {"land": land_maximum, "ocean": ocean_maximum, "combined": max(land_maximum, ocean_maximum)},
        "histograms": {
            "binMinimum": HISTOGRAM_MINIMUM,
            "binWidth": HISTOGRAM_BIN_WIDTH,
            "areaTotal": round(land_area + ocean_area, 3),
            "landArea": land_area,
            "oceanArea": ocean_area,
            "land": land_histogram,
            "ocean": ocean_histogram,
            "combined": combined_histogram,
        },
    }


def create_manifest(frames: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "schemaVersion": "1.0.0",
        "prototypeVersion": "1.0.0-real-data",
        "temporalCoverage": "annual",
        "created": "2026-01-01T00:00:00.000Z",
        "year": YEAR,
        "notice": "Real 2025 weekly temperature fields. Land and inland-water cells use Copernicus ERA5 daily-mean 2 m air temperature; OISST-supported ocean cells use NOAA OISST v2.1 sea-surface temperature.",
        "grid": {"width": GRID_WIDTH, "height": GRID_HEIGHT, "cellCount": GRID_WIDTH * GRID_HEIGHT, "resolution": 0.25, "latitudeOrigin": 89.875, "longitudeOrigin": -179.875, "rowDirection": "north-to-south", "columnDirection": "west-to-east", "index": "row * 1440 + column"},
        "encoding": {"type": "Uint16", "byteOrder": "little-endian", "scale": 0.01, "offset": -100.0, "missing": 65535, "reserved": 65534, "units": "degrees Celsius"},
        "legend": {"minimum": HISTOGRAM_MINIMUM, "maximum": HISTOGRAM_MAXIMUM, "histogramBinWidth": HISTOGRAM_BIN_WIDTH, "histogramBinCount": HISTOGRAM_BIN_COUNT, "fixedAnnualScale": True},
        "sources": {"land": {"dataset": "Copernicus ERA5 daily statistics", "variable": "daily-mean 2 m air temperature"}, "ocean": {"dataset": "NOAA OISST v2.1 AVHRR", "variable": "daily sea-surface temperature"}, "units": "°C"},
        "mask": {"filename": "surface-mask.bin", "type": "Uint8", "ocean": 0, "land": 1, "source": "NOAA OISST v2.1 invariant valid-data footprint"},
        "frames": frames,
    }


def publish_preview() -> None:
    if not (SYNTHETIC_ARCHIVE / "manifest.json").is_file():
        raise FileNotFoundError("Synthetic archive must exist before publishing the real annual preview")
    for relative in ("manifest.json", "surface-mask.bin"):
        target = PREVIEW_ROOT / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(OUTPUT_ROOT / relative, target)
    for layer in ("air", "sst"):
        for source in sorted((OUTPUT_ROOT / layer).glob("week-*.bin")):
            target = PREVIEW_ROOT / layer / source.name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--publish-preview", action="store_true")
    args = parser.parse_args()
    checksum_inventory = RAW_ROOT / "source-checksums.json"
    if not checksum_inventory.is_file():
        raise FileNotFoundError("Run download_year.py --source all before processing")
    era_index, era_lat, era_lon = build_era_index()
    periods = weekly_periods(YEAR)
    if len(periods) != 52:
        raise ValueError(f"Expected 52 weekly periods; found {len(periods)}")

    baseline_ocean: np.ndarray | None = None
    frames: list[dict[str, Any]] = []
    frame_audit: list[dict[str, Any]] = []
    for frame_index, period in enumerate(periods):
        sst, baseline_ocean = load_oisst_period(period, baseline_ocean)
        air = load_era_period(period, era_index, era_lat, era_lon)
        surface_mask = np.where(baseline_ocean, 0, 1).astype(np.uint8)
        air_encoded = encode_temperature_field(air, surface_mask == 1)
        sst_encoded = encode_temperature_field(sst, surface_mask == 0)
        frame_id = f"week-{frame_index:02d}"
        air_path = OUTPUT_ROOT / "air" / f"{frame_id}.bin"
        sst_path = OUTPUT_ROOT / "sst" / f"{frame_id}.bin"
        atomic_array_write(air_path, air_encoded, EXPECTED_RASTER_BYTES)
        atomic_array_write(sst_path, sst_encoded, EXPECTED_RASTER_BYTES)
        frames.append(frame_metadata(frame_index, period, surface_mask, air_encoded, sst_encoded))
        frame_audit.append({"id": frame_id, "start": period[0].isoformat(), "end": period[-1].isoformat(), "observations": len(period), "airSha256": sha256_file(air_path), "sstSha256": sha256_file(sst_path)})
        print(f"Processed {frame_id} ({period[0]}–{period[-1]})")

    if baseline_ocean is None:
        raise ValueError("No OISST surface mask was produced")
    surface_mask = np.where(baseline_ocean, 0, 1).astype(np.uint8)
    mask_path = OUTPUT_ROOT / "surface-mask.bin"
    atomic_array_write(mask_path, surface_mask, EXPECTED_MASK_BYTES)
    write_json(OUTPUT_ROOT / "manifest.json", create_manifest(frames))

    legacy = np.fromfile(LEGACY_MASK_PATH, dtype=np.uint8).reshape(GRID_HEIGHT, GRID_WIDTH).astype(bool)
    authoritative_air = surface_mask.astype(bool)
    source_files = sorted(RAW_ROOT.rglob("*.nc"))
    report = {
        "status": "complete",
        "year": YEAR,
        "sourceFiles": len(source_files),
        "sourceBytes": sum(path.stat().st_size for path in source_files),
        "sourceChecksumInventory": {"path": checksum_inventory.relative_to(PROJECT_ROOT).as_posix(), "sha256": sha256_file(checksum_inventory)},
        "mask": {"path": mask_path.relative_to(PROJECT_ROOT).as_posix(), "bytes": mask_path.stat().st_size, "sha256": sha256_file(mask_path), "invariantDays": len(dates_in_year(YEAR)), "oceanCells": int((surface_mask == 0).sum()), "airCells": int((surface_mask == 1).sum()), "legacyOceanNowAir": int(((~legacy) & authoritative_air).sum()), "legacyLandNowOcean": int((legacy & (~authoritative_air)).sum())},
        "coverage": {"frames": len(frames), "days": sum(len(period) for period in periods), "cellsPerFrame": GRID_WIDTH * GRID_HEIGHT, "gaps": 0, "overlaps": 0},
        "outputs": {"rasterFiles": len(frame_audit) * 2, "rasterBytes": sum(path.stat().st_size for layer in ("air", "sst") for path in (OUTPUT_ROOT / layer).glob("week-*.bin")), "frames": frame_audit},
    }
    write_json(OUTPUT_ROOT / "annual-validation-report.json", report)
    if args.publish_preview:
        publish_preview()
        print(f"Published opt-in annual preview at {PREVIEW_ROOT.relative_to(PROJECT_ROOT)}")
    print(f"Completed {len(frames)} real weekly frames")


if __name__ == "__main__":
    with warnings.catch_warnings():
        warnings.simplefilter("error", RuntimeWarning)
        main()
