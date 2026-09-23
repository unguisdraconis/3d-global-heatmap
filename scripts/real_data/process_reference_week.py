"""Convert the real 2025 reference week into TEMPERIES validation rasters."""

from __future__ import annotations

import argparse
import shutil
import tempfile
import warnings
import zipfile
from pathlib import Path
from typing import Any

import numpy as np
from netCDF4 import Dataset

from common import (
    ENCODING_MISSING,
    GRID_HEIGHT,
    GRID_WIDTH,
    align_oisst_to_canonical,
    as_float_with_nan,
    bilinear_to_canonical,
    decode_temperature_field,
    derive_surface_mask,
    encode_temperature_field,
    sha256_file,
    write_json,
)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
RAW_ROOT = PROJECT_ROOT / "untouched_data" / "2025" / "week-00"
OUTPUT_ROOT = PROJECT_ROOT / "validation_data" / "2025" / "week-00"
OUTPUT_YEAR_ROOT = PROJECT_ROOT / "validation_data" / "2025"
LAND_MASK_PATH = PROJECT_ROOT / "public" / "data" / "2025" / "land-mask.bin"
EXPECTED_BYTES = GRID_HEIGHT * GRID_WIDTH * 2
PREVIEW_ROOT = PROJECT_ROOT / "public" / "real-reference" / "data" / "2025"
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


def load_oisst() -> tuple[np.ndarray, np.ndarray, dict[str, Any], list[Path]]:
    files = sorted((RAW_ROOT / "oisst").glob("oisst-avhrr-v02r01.2025010[1-7].nc"))
    if len(files) != 7:
        raise FileNotFoundError(f"Expected seven OISST daily files; found {len(files)}")

    days: list[np.ndarray] = []
    validity: list[np.ndarray] = []
    units: set[str] = set()
    for path in files:
        with Dataset(path) as dataset:
            if "sst" not in dataset.variables:
                raise ValueError(f"{path.name} has no sst variable")
            variable = dataset.variables["sst"]
            data = np.ma.squeeze(variable[:])
            if data.ndim != 2:
                raise ValueError(f"{path.name} sst shape is {data.shape}, not a daily 2D field")
            lat = coordinate(dataset, ("lat", "latitude"))
            lon = coordinate(dataset, ("lon", "longitude"))
            aligned = align_oisst_to_canonical(data, lat, lon)
            days.append(aligned)
            validity.append(np.isfinite(aligned))
            units.add(str(getattr(variable, "units", "unknown")))

    weekly = finite_mean(np.stack(days))
    surface_mask = derive_surface_mask(np.stack(validity))
    metadata = {
        "dataset": "NOAA OISST v2.1 AVHRR",
        "variable": "sst",
        "units": sorted(units),
        "dailyFiles": len(files),
        "supportInvariantDays": len(files),
        "alignment": "native 0.25-degree cell centers reordered; no interpolation",
    }
    return weekly, surface_mask, metadata, files


def temperature_variable(dataset: Dataset):
    for name in ("t2m", "2m_temperature"):
        if name in dataset.variables:
            return dataset.variables[name]
    for variable in dataset.variables.values():
        if getattr(variable, "standard_name", "") == "air_temperature" and variable.ndim >= 2:
            return variable
    raise ValueError("Could not find the ERA5 2 m temperature variable")


def load_era5() -> tuple[np.ndarray, dict[str, Any], list[Path]]:
    source_files = sorted((RAW_ROOT / "era5").glob("*.nc")) + sorted(
        (RAW_ROOT / "era5").glob("*.zip")
    )
    if len(source_files) != 1:
        raise FileNotFoundError(f"Expected one ERA5 NetCDF file or ZIP archive; found {len(source_files)}")

    source_days: list[np.ndarray] = []
    units: set[str] = set()
    variable_names: set[str] = set()

    def consume(path: Path) -> tuple[np.ndarray, np.ndarray]:
        with Dataset(path) as dataset:
            variable = temperature_variable(dataset)
            data = as_float_with_nan(variable[:]).squeeze()
            if data.ndim == 2:
                data = data[None, :, :]
            if data.ndim != 3:
                raise ValueError(f"ERA5 temperature shape {data.shape} is not time x lat x lon")
            latitudes = coordinate(dataset, ("latitude", "lat"))
            longitudes = coordinate(dataset, ("longitude", "lon"))
            units.add(str(getattr(variable, "units", "unknown")))
            variable_names.add(variable.name)
            source_days.extend(data[index] for index in range(data.shape[0]))
            return latitudes, longitudes

    source = source_files[0]
    if source.suffix.lower() == ".zip":
        with tempfile.TemporaryDirectory(prefix="temperies-era5-") as temporary:
            with zipfile.ZipFile(source) as archive:
                members = [
                    member
                    for member in archive.namelist()
                    if member.lower().endswith((".nc", ".nc4"))
                ]
                if not members:
                    raise ValueError("The ERA5 archive contains no NetCDF file")
                archive.extractall(temporary, members)
            extracted = sorted(Path(temporary).rglob("*.nc*"))
            for path in extracted:
                lat, lon = consume(path)
    else:
        lat, lon = consume(source)

    if len(source_days) != 7:
        raise ValueError(f"Expected seven ERA5 daily means; found {len(source_days)}")
    source_weekly = finite_mean(np.stack(source_days))
    if np.nanmedian(source_weekly) > 100.0:
        source_weekly = source_weekly - 273.15
    weekly = bilinear_to_canonical(source_weekly, lat, lon)
    metadata = {
        "dataset": "Copernicus ERA5 daily statistics",
        "variable": sorted(variable_names),
        "units": sorted(units),
        "dailyMeans": len(source_days),
        "alignment": "bilinear interpolation from ERA5 grid points to 0.25-degree cell centers",
    }
    return weekly, metadata, source_files


def load_land_mask() -> np.ndarray:
    raw = np.fromfile(LAND_MASK_PATH, dtype=np.uint8)
    if raw.size != GRID_HEIGHT * GRID_WIDTH:
        raise ValueError(f"Land mask has {raw.size} cells, expected {GRID_HEIGHT * GRID_WIDTH}")
    if not np.isin(raw, (0, 1)).all():
        raise ValueError("Land mask contains values other than 0 and 1")
    return raw.reshape(GRID_HEIGHT, GRID_WIDTH).astype(bool)


def write_surface_mask(surface_mask: np.ndarray) -> dict[str, Any]:
    mask = np.asarray(surface_mask, dtype=np.uint8)
    if mask.shape != (GRID_HEIGHT, GRID_WIDTH) or not np.isin(mask, (0, 1)).all():
        raise ValueError("Surface mask must be a 720 x 1440 Uint8 field containing 0 or 1")

    path = OUTPUT_YEAR_ROOT / "surface-mask.bin"
    path.parent.mkdir(parents=True, exist_ok=True)
    mask.tofile(path)
    legacy_land = load_land_mask()
    authoritative_air = mask.astype(bool)
    return {
        "path": path.relative_to(PROJECT_ROOT).as_posix(),
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
        "type": "Uint8",
        "ocean": 0,
        "air": 1,
        "source": "NOAA OISST v2.1 invariant valid-data footprint",
        "oceanCells": int((mask == 0).sum()),
        "airCells": int((mask == 1).sum()),
        "legacyNaturalEarthComparison": {
            "legacyOceanNowAir": int(((~legacy_land) & authoritative_air).sum()),
            "legacyLandNowOcean": int((legacy_land & (~authoritative_air)).sum()),
            "totalChangedCells": int((legacy_land != authoritative_air).sum()),
        },
    }


def load_surface_mask() -> np.ndarray:
    path = OUTPUT_YEAR_ROOT / "surface-mask.bin"
    raw = np.fromfile(path, dtype=np.uint8)
    if raw.size != GRID_HEIGHT * GRID_WIDTH or not np.isin(raw, (0, 1)).all():
        raise ValueError("Stored OISST-derived surface mask is invalid")
    return raw.reshape(GRID_HEIGHT, GRID_WIDTH)


def field_report(
    source: np.ndarray, encoded: np.ndarray, valid: np.ndarray, path: Path
) -> dict[str, Any]:
    decoded = decode_temperature_field(encoded)
    error = np.abs(decoded[valid] - source[valid])
    samples = []
    for row, column in ((90, 720), (270, 360), (360, 720), (540, 1080), (630, 180)):
        if valid[row, column]:
            samples.append(
                {
                    "row": row,
                    "column": column,
                    "sourceCelsius": round(float(source[row, column]), 6),
                    "decodedCelsius": round(float(decoded[row, column]), 2),
                }
            )
    return {
        "path": path.relative_to(PROJECT_ROOT).as_posix(),
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
        "validCells": int(valid.sum()),
        "missingCells": int((encoded == ENCODING_MISSING).sum()),
        "minimumCelsius": round(float(np.nanmin(source[valid])), 4),
        "maximumCelsius": round(float(np.nanmax(source[valid])), 4),
        "maximumQuantizationErrorCelsius": round(float(error.max(initial=0.0)), 8),
        "samples": samples,
    }


def write_field(name: str, values: np.ndarray, valid: np.ndarray) -> dict[str, Any]:
    encoded = encode_temperature_field(values, valid)
    path = OUTPUT_ROOT / f"{name}.bin"
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded.tofile(path)
    if path.stat().st_size != EXPECTED_BYTES:
        raise ValueError(f"{path.name} has the wrong byte length")
    return field_report(values, encoded, valid, path)


def rounded_histogram(values: np.ndarray, valid: np.ndarray) -> tuple[list[float], float]:
    latitude_weights = np.cos(np.deg2rad(89.875 - np.arange(GRID_HEIGHT) * 0.25))
    weights = np.broadcast_to(latitude_weights[:, None], values.shape)
    finite = np.isfinite(values)
    bins = np.full(values.shape, -1, dtype=np.int32)
    bins[finite] = np.floor(
        (values[finite] - HISTOGRAM_MINIMUM) / HISTOGRAM_BIN_WIDTH
    ).astype(np.int32)
    included = valid & finite & (bins >= 0) & (bins < HISTOGRAM_BIN_COUNT)
    histogram = np.bincount(
        bins[included], weights=weights[included], minlength=HISTOGRAM_BIN_COUNT
    )[:HISTOGRAM_BIN_COUNT]
    return [round(float(value), 3) for value in histogram], round(float(weights[valid].sum()), 3)


def publish_reference_dataset(surface_mask: np.ndarray) -> Path:
    air_source = OUTPUT_ROOT / "air.bin"
    sst_source = OUTPUT_ROOT / "sst.bin"
    mask_source = OUTPUT_YEAR_ROOT / "surface-mask.bin"
    if not all(path.is_file() for path in (air_source, sst_source, mask_source)):
        raise FileNotFoundError("Complete validation outputs are required before publishing a preview")

    air_encoded = np.fromfile(air_source, dtype="<u2").reshape(GRID_HEIGHT, GRID_WIDTH)
    sst_encoded = np.fromfile(sst_source, dtype="<u2").reshape(GRID_HEIGHT, GRID_WIDTH)
    air = decode_temperature_field(air_encoded)
    sst = decode_temperature_field(sst_encoded)
    air_valid = surface_mask == 1
    ocean_valid = surface_mask == 0
    land_histogram, land_area = rounded_histogram(air, air_valid)
    ocean_histogram, ocean_area = rounded_histogram(sst, ocean_valid)
    combined_histogram = [
        round(land + ocean, 3)
        for land, ocean in zip(land_histogram, ocean_histogram, strict=True)
    ]

    air_target = PREVIEW_ROOT / "air" / "week-00.bin"
    sst_target = PREVIEW_ROOT / "sst" / "week-00.bin"
    mask_target = PREVIEW_ROOT / "surface-mask.bin"
    air_target.parent.mkdir(parents=True, exist_ok=True)
    sst_target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(air_source, air_target)
    shutil.copyfile(sst_source, sst_target)
    shutil.copyfile(mask_source, mask_target)

    land_minimum = round(float(np.nanmin(air[air_valid])), 2)
    land_maximum = round(float(np.nanmax(air[air_valid])), 2)
    ocean_minimum = round(float(np.nanmin(sst[ocean_valid])), 2)
    ocean_maximum = round(float(np.nanmax(sst[ocean_valid])), 2)
    manifest = {
        "schemaVersion": "1.0.0",
        "prototypeVersion": "0.3.0-real-reference",
        "temporalCoverage": "reference",
        "created": "2025-01-08T00:00:00.000Z",
        "year": 2025,
        "notice": (
            "Real-data validation frame for January 1–7, 2025. Land and inland-water "
            "cells use Copernicus ERA5 daily-mean 2 m air temperature; OISST-supported "
            "ocean cells use NOAA OISST v2.1 sea-surface temperature."
        ),
        "grid": {
            "width": GRID_WIDTH,
            "height": GRID_HEIGHT,
            "cellCount": GRID_WIDTH * GRID_HEIGHT,
            "resolution": 0.25,
            "latitudeOrigin": 89.875,
            "longitudeOrigin": -179.875,
            "rowDirection": "north-to-south",
            "columnDirection": "west-to-east",
            "index": "row * 1440 + column",
        },
        "encoding": {
            "type": "Uint16",
            "byteOrder": "little-endian",
            "scale": 0.01,
            "offset": -100.0,
            "missing": 65535,
            "reserved": 65534,
            "units": "degrees Celsius",
        },
        "legend": {
            "minimum": HISTOGRAM_MINIMUM,
            "maximum": HISTOGRAM_MAXIMUM,
            "histogramBinWidth": HISTOGRAM_BIN_WIDTH,
            "histogramBinCount": HISTOGRAM_BIN_COUNT,
            "fixedAnnualScale": True,
        },
        "sources": {
            "land": {
                "dataset": "Copernicus ERA5 daily statistics",
                "variable": "daily-mean 2 m air temperature",
            },
            "ocean": {
                "dataset": "NOAA OISST v2.1 AVHRR",
                "variable": "daily sea-surface temperature",
            },
            "units": "°C",
        },
        "mask": {
            "filename": "surface-mask.bin",
            "type": "Uint8",
            "ocean": 0,
            "land": 1,
            "source": "NOAA OISST v2.1 invariant valid-data footprint",
        },
        "frames": [
            {
                "id": "week-00",
                "frame": 0,
                "startDate": "2025-01-01",
                "endDate": "2025-01-07",
                "representativeDate": "2025-01-04",
                "observations": 7,
                "air": "air/week-00.bin",
                "sst": "sst/week-00.bin",
                "minimums": {
                    "land": land_minimum,
                    "ocean": ocean_minimum,
                    "combined": min(land_minimum, ocean_minimum),
                },
                "maximums": {
                    "land": land_maximum,
                    "ocean": ocean_maximum,
                    "combined": max(land_maximum, ocean_maximum),
                },
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
        ],
    }
    manifest_path = PREVIEW_ROOT / "manifest.json"
    write_json(manifest_path, manifest)
    return manifest_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", choices=("all", "oisst", "era5"), default="all")
    parser.add_argument(
        "--publish-preview",
        action="store_true",
        help="copy the complete validation week into the opt-in Vite preview dataset",
    )
    args = parser.parse_args()

    report: dict[str, Any] = {
        "status": "validation-only",
        "period": {"start": "2025-01-01", "end": "2025-01-07", "days": 7},
        "canonicalGrid": {
            "width": GRID_WIDTH,
            "height": GRID_HEIGHT,
            "resolutionDegrees": 0.25,
            "rowDirection": "north-to-south",
            "columnDirection": "west-to-east",
        },
        "encoding": {
            "type": "Uint16",
            "byteOrder": "little-endian",
            "scale": 0.01,
            "offset": -100.0,
            "missing": 65535,
        },
        "sources": {},
        "outputs": {},
        "mask": None,
        "sourceFiles": [],
    }

    source_files: list[Path] = []
    surface_mask: np.ndarray | None = None
    if args.source in ("all", "oisst"):
        sst, surface_mask, metadata, files = load_oisst()
        report["mask"] = write_surface_mask(surface_mask)
        valid = surface_mask == 0
        if not np.isfinite(sst[valid]).all():
            raise ValueError("OISST has missing values inside its authoritative ocean support")
        report["sources"]["ocean"] = metadata
        report["outputs"]["sst"] = write_field("sst", sst, valid)
        source_files.extend(files)

    if args.source in ("all", "era5"):
        if surface_mask is None:
            surface_mask = load_surface_mask()
            report["mask"] = write_surface_mask(surface_mask)
        air, metadata, files = load_era5()
        valid = surface_mask == 1
        if not np.isfinite(air[valid]).all():
            raise ValueError("ERA5 has missing values inside the authoritative air support")
        report["sources"]["land"] = metadata
        report["outputs"]["air"] = write_field("air", air, valid)
        source_files.extend(files)

    if args.source == "all":
        air_valid = surface_mask == 1
        ocean_valid = surface_mask == 0
        report["compositeCoverage"] = {
            "cells": GRID_HEIGHT * GRID_WIDTH,
            "airCells": int(air_valid.sum()),
            "oceanCells": int(ocean_valid.sum()),
            "gaps": int((~(air_valid | ocean_valid)).sum()),
            "overlaps": int((air_valid & ocean_valid).sum()),
        }

    report["sourceFiles"] = [
        {
            "path": path.relative_to(PROJECT_ROOT).as_posix(),
            "bytes": path.stat().st_size,
            "sha256": sha256_file(path),
        }
        for path in source_files
    ]
    report["provenance"] = {
        "era5": "https://cds.climate.copernicus.eu/datasets/derived-era5-single-levels-daily-statistics",
        "oisst": "https://www.ncei.noaa.gov/products/optimum-interpolation-sst",
    }
    write_json(OUTPUT_ROOT / "validation-report.json", report)
    print(f"Wrote validation outputs to {OUTPUT_ROOT.relative_to(PROJECT_ROOT)}")
    if args.publish_preview:
        if args.source != "all" or surface_mask is None:
            raise ValueError("Preview publishing requires --source all")
        manifest_path = publish_reference_dataset(surface_mask)
        print(f"Published opt-in preview at {manifest_path.relative_to(PROJECT_ROOT)}")


if __name__ == "__main__":
    with warnings.catch_warnings():
        warnings.simplefilter("error", RuntimeWarning)
        main()
