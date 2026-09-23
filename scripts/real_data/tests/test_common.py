from __future__ import annotations

import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from common import (  # noqa: E402
    ENCODING_MISSING,
    GRID_HEIGHT,
    GRID_WIDTH,
    align_oisst_to_canonical,
    bilinear_to_canonical,
    canonical_latitudes,
    canonical_longitudes,
    decode_temperature_field,
    derive_surface_mask,
    encode_temperature_field,
    dates_in_year,
    weekly_periods,
)


class CanonicalGridTests(unittest.TestCase):
    def test_annual_calendar_has_52_frames_and_an_eight_day_final_period(self) -> None:
        days = dates_in_year(2025)
        periods = weekly_periods(2025)
        self.assertEqual(len(days), 365)
        self.assertEqual(len(periods), 52)
        self.assertTrue(all(len(period) == 7 for period in periods[:-1]))
        self.assertEqual(len(periods[-1]), 8)
        self.assertEqual(periods[0][0].isoformat(), "2025-01-01")
        self.assertEqual(periods[-1][-1].isoformat(), "2025-12-31")

    def test_cell_centers_cover_the_globe_without_duplicate_seam(self) -> None:
        lat = canonical_latitudes()
        lon = canonical_longitudes()
        self.assertEqual((lat[0], lat[-1]), (89.875, -89.875))
        self.assertEqual((lon[0], lon[-1]), (-179.875, 179.875))
        self.assertTrue(np.allclose(np.diff(lat), -0.25))
        self.assertTrue(np.allclose(np.diff(lon), 0.25))

    def test_native_oisst_grid_is_reordered_without_interpolation(self) -> None:
        lat = canonical_latitudes()[::-1]
        lon = (canonical_longitudes() + 360.0) % 360.0
        normalized_lon = ((lon + 180.0) % 360.0) - 180.0
        values = lat[:, None] + normalized_lon[None, :] / 1000.0
        aligned = align_oisst_to_canonical(values, lat, lon)
        expected = canonical_latitudes()[:, None] + canonical_longitudes()[None, :] / 1000.0
        self.assertTrue(np.allclose(aligned, expected))
        self.assertEqual(aligned.shape, (GRID_HEIGHT, GRID_WIDTH))

    def test_encoding_round_trip_stays_within_half_a_hundredth_degree(self) -> None:
        values = np.linspace(-80.0, 60.0, GRID_HEIGHT * GRID_WIDTH).reshape(
            GRID_HEIGHT, GRID_WIDTH
        )
        valid = np.ones(values.shape, dtype=bool)
        valid[0, 0] = False
        encoded = encode_temperature_field(values, valid)
        decoded = decode_temperature_field(encoded)
        self.assertEqual(encoded[0, 0], ENCODING_MISSING)
        self.assertTrue(np.isnan(decoded[0, 0]))
        self.assertLessEqual(float(np.nanmax(np.abs(decoded - values))), 0.005000001)

    def test_surface_mask_routes_every_cell_from_stable_oisst_support(self) -> None:
        ocean = np.zeros((GRID_HEIGHT, GRID_WIDTH), dtype=bool)
        ocean[:, : GRID_WIDTH // 2] = True
        surface = derive_surface_mask(np.stack((ocean, ocean, ocean)))
        self.assertTrue(np.all(surface[:, : GRID_WIDTH // 2] == 0))
        self.assertTrue(np.all(surface[:, GRID_WIDTH // 2 :] == 1))
        self.assertEqual(int((surface == 0).sum() + (surface == 1).sum()), GRID_HEIGHT * GRID_WIDTH)

    def test_surface_mask_rejects_daily_support_drift(self) -> None:
        first = np.ones((GRID_HEIGHT, GRID_WIDTH), dtype=bool)
        second = first.copy()
        second[100, 200] = False
        with self.assertRaisesRegex(ValueError, "changed in 1 canonical cells"):
            derive_surface_mask(np.stack((first, second)))

    def test_periodic_bilinear_sampling_is_continuous_at_dateline(self) -> None:
        lat = np.array([-90.0, 0.0, 90.0])
        lon = np.array([-180.0, -90.0, 0.0, 90.0])
        values = np.cos(np.deg2rad(lon))[None, :] + lat[:, None] / 180.0
        result = bilinear_to_canonical(values, lat, lon)
        self.assertEqual(result.shape, (GRID_HEIGHT, GRID_WIDTH))
        self.assertLess(float(np.max(np.abs(result[:, 0] - result[:, -1]))), 0.01)


if __name__ == "__main__":
    unittest.main()
