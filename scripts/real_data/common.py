"""Shared grid, encoding, checksum, and resampling utilities."""

from __future__ import annotations

import hashlib
import json
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import numpy as np

GRID_WIDTH = 1440
GRID_HEIGHT = 720
GRID_RESOLUTION = 0.25
LATITUDE_ORIGIN = 89.875
LONGITUDE_ORIGIN = -179.875

ENCODING_SCALE = 0.01
ENCODING_OFFSET = -100.0
ENCODING_MISSING = np.uint16(65535)
ENCODING_RESERVED = np.uint16(65534)


def canonical_latitudes() -> np.ndarray:
    return LATITUDE_ORIGIN - np.arange(GRID_HEIGHT, dtype=np.float64) * GRID_RESOLUTION


def canonical_longitudes() -> np.ndarray:
    return LONGITUDE_ORIGIN + np.arange(GRID_WIDTH, dtype=np.float64) * GRID_RESOLUTION


def dates_in_year(year: int) -> tuple[date, ...]:
    first = date(year, 1, 1)
    next_year = date(year + 1, 1, 1)
    return tuple(first + timedelta(days=offset) for offset in range((next_year - first).days))


def weekly_periods(year: int) -> tuple[tuple[date, ...], ...]:
    days = dates_in_year(year)
    # TEMPERIES intentionally uses 52 frames: 51 seven-day periods and one
    # final period containing every remaining day of the calendar year.
    return tuple(tuple(days[offset : offset + 7]) for offset in range(0, 51 * 7, 7)) + (
        tuple(days[51 * 7 :]),
    )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def as_float_with_nan(values: np.ndarray) -> np.ndarray:
    """Convert a masked or regular NetCDF array into float64 with NaNs."""
    if np.ma.isMaskedArray(values):
        return np.asarray(np.ma.filled(values, np.nan), dtype=np.float64)
    return np.asarray(values, dtype=np.float64)


def align_oisst_to_canonical(
    values: np.ndarray, latitudes: np.ndarray, longitudes: np.ndarray
) -> np.ndarray:
    """Reorder the native 0.25-degree OISST centers without interpolation."""
    data = as_float_with_nan(values)
    lat = np.asarray(latitudes, dtype=np.float64)
    lon = ((np.asarray(longitudes, dtype=np.float64) + 180.0) % 360.0) - 180.0

    if data.shape != (lat.size, lon.size):
        raise ValueError(f"OISST data shape {data.shape} does not match coordinates")

    lat_order = np.argsort(lat)[::-1]
    lon_order = np.argsort(lon)
    lat = lat[lat_order]
    lon = lon[lon_order]
    data = data[np.ix_(lat_order, lon_order)]

    expected_lat = canonical_latitudes()
    expected_lon = canonical_longitudes()
    if lat.shape != expected_lat.shape or not np.allclose(lat, expected_lat, atol=1e-6):
        raise ValueError("OISST latitude centers do not match the canonical grid")
    if lon.shape != expected_lon.shape or not np.allclose(lon, expected_lon, atol=1e-6):
        raise ValueError("OISST longitude centers do not match the canonical grid")
    return data


def derive_surface_mask(ocean_validity: np.ndarray) -> np.ndarray:
    """Create a stable routing mask: 0 for OISST ocean, 1 for ERA5 air."""
    validity = np.asarray(ocean_validity, dtype=bool)
    if validity.ndim != 3 or validity.shape[1:] != (GRID_HEIGHT, GRID_WIDTH):
        raise ValueError("Ocean-validity stack must be days x 720 x 1440")
    if validity.shape[0] == 0:
        raise ValueError("At least one OISST validity field is required")

    baseline = validity[0]
    changed = np.any(validity != baseline, axis=0)
    if changed.any():
        raise ValueError(
            f"OISST surface support changed in {int(changed.sum())} canonical cells"
        )
    return np.where(baseline, 0, 1).astype(np.uint8)


def bilinear_to_canonical(
    values: np.ndarray, latitudes: np.ndarray, longitudes: np.ndarray
) -> np.ndarray:
    """Bilinearly sample a regular global grid onto canonical cell centers."""
    data = as_float_with_nan(values)
    lat = np.asarray(latitudes, dtype=np.float64)
    lon = ((np.asarray(longitudes, dtype=np.float64) + 180.0) % 360.0) - 180.0
    if data.shape != (lat.size, lon.size):
        raise ValueError(f"Source data shape {data.shape} does not match coordinates")

    lat_order = np.argsort(lat)
    lon_order = np.argsort(lon)
    lat = lat[lat_order]
    lon = lon[lon_order]
    data = data[np.ix_(lat_order, lon_order)]

    if np.any(np.diff(lat) <= 0) or np.any(np.diff(lon) <= 0):
        raise ValueError("Source coordinates must be unique and monotonic")

    target_lat = canonical_latitudes()
    target_lon = canonical_longitudes()

    upper = np.searchsorted(lat, target_lat, side="right")
    upper = np.clip(upper, 1, lat.size - 1)
    lower = upper - 1
    lat_span = lat[upper] - lat[lower]
    lat_weight = (target_lat - lat[lower]) / lat_span

    # Periodic longitude extension ensures interpolation is continuous at the dateline.
    lon_extended = np.concatenate(([lon[-1] - 360.0], lon, [lon[0] + 360.0]))
    data_extended = np.concatenate((data[:, -1:], data, data[:, :1]), axis=1)
    right = np.searchsorted(lon_extended, target_lon, side="right")
    right = np.clip(right, 1, lon_extended.size - 1)
    left = right - 1
    lon_span = lon_extended[right] - lon_extended[left]
    lon_weight = (target_lon - lon_extended[left]) / lon_span

    lower_left = data_extended[lower[:, None], left[None, :]]
    lower_right = data_extended[lower[:, None], right[None, :]]
    upper_left = data_extended[upper[:, None], left[None, :]]
    upper_right = data_extended[upper[:, None], right[None, :]]

    lower_row = lower_left * (1.0 - lon_weight) + lower_right * lon_weight
    upper_row = upper_left * (1.0 - lon_weight) + upper_right * lon_weight
    return lower_row * (1.0 - lat_weight[:, None]) + upper_row * lat_weight[:, None]


def encode_temperature_field(values_celsius: np.ndarray, valid: np.ndarray) -> np.ndarray:
    values = np.asarray(values_celsius, dtype=np.float64)
    validity = np.asarray(valid, dtype=bool) & np.isfinite(values)
    if values.shape != (GRID_HEIGHT, GRID_WIDTH) or validity.shape != values.shape:
        raise ValueError("Temperature field and validity mask must be 720 x 1440")

    result = np.full(values.shape, ENCODING_MISSING, dtype="<u2")
    encoded = np.rint((values[validity] - ENCODING_OFFSET) / ENCODING_SCALE)
    if encoded.size and (encoded.min() < 0 or encoded.max() >= int(ENCODING_RESERVED)):
        raise ValueError("Temperature value falls outside the Uint16 encoding range")
    result[validity] = encoded.astype("<u2")
    return result


def decode_temperature_field(encoded: np.ndarray) -> np.ndarray:
    raw = np.asarray(encoded, dtype="<u2")
    result = raw.astype(np.float64) * ENCODING_SCALE + ENCODING_OFFSET
    result[raw >= ENCODING_RESERVED] = np.nan
    return result
