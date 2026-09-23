"""Download untouched source files for the 2025-01-01 through 2025-01-07 trial."""

from __future__ import annotations

import argparse
import os
from datetime import date, timedelta
from pathlib import Path
from urllib.request import Request, urlopen

from common import sha256_file, write_json

PROJECT_ROOT = Path(__file__).resolve().parents[2]
RAW_ROOT = PROJECT_ROOT / "untouched_data" / "2025" / "week-00"
REFERENCE_DATES = tuple(date(2025, 1, 1) + timedelta(days=offset) for offset in range(7))
OISST_ROOT = (
    "https://www.ncei.noaa.gov/data/sea-surface-temperature-optimum-interpolation/"
    "v2.1/access/avhrr"
)


def download(url: str, destination: Path) -> None:
    if destination.exists():
        print(f"Reusing {destination.relative_to(PROJECT_ROOT)}")
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".part")
    request = Request(url, headers={"User-Agent": "TEMPERIES-real-data-pipeline/1.0"})
    print(f"Downloading {url}")
    with urlopen(request, timeout=120) as response, temporary.open("wb") as target:
        while block := response.read(1024 * 1024):
            target.write(block)
    os.replace(temporary, destination)


def download_oisst() -> list[Path]:
    files: list[Path] = []
    for current in REFERENCE_DATES:
        stamp = current.strftime("%Y%m%d")
        filename = f"oisst-avhrr-v02r01.{stamp}.nc"
        destination = RAW_ROOT / "oisst" / filename
        download(f"{OISST_ROOT}/{current:%Y%m}/{filename}", destination)
        files.append(destination)
    return files


def has_cds_credentials() -> bool:
    return (Path.home() / ".cdsapirc").is_file() or bool(os.environ.get("CDSAPI_KEY"))


def download_era5() -> list[Path]:
    if not has_cds_credentials():
        raise RuntimeError(
            "CDS credentials are not configured. Follow https://cds.climate.copernicus.eu/how-to-api "
            "and create the private ~/.cdsapirc file before requesting ERA5."
        )

    import cdsapi

    destination = RAW_ROOT / "era5" / "era5-2m-temperature-daily-mean-20250101-20250107.nc"
    request = {
        "product_type": "reanalysis",
        "variable": ["2m_temperature"],
        "year": "2025",
        "month": ["01"],
        "day": [f"{day:02d}" for day in range(1, 8)],
        "daily_statistic": "daily_mean",
        "time_zone": "utc+00:00",
        "frequency": "1_hourly",
    }
    write_json(RAW_ROOT / "era5" / "request.json", request)
    if destination.exists():
        print(f"Reusing {destination.relative_to(PROJECT_ROOT)}")
    else:
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_suffix(".nc.part")
        print("Submitting the ERA5 daily-statistics request to CDS")
        cdsapi.Client().retrieve(
            "derived-era5-single-levels-daily-statistics", request, str(temporary)
        )
        os.replace(temporary, destination)
    return [destination]


def write_checksums(files: list[Path]) -> None:
    known_files = {
        path
        for pattern in ("*.nc", "*.nc4", "*.zip")
        for path in RAW_ROOT.rglob(pattern)
    }
    known_files.update(files)
    records = [
        {
            "path": path.relative_to(PROJECT_ROOT).as_posix(),
            "bytes": path.stat().st_size,
            "sha256": sha256_file(path),
        }
        for path in sorted(known_files)
    ]
    write_json(RAW_ROOT / "source-checksums.json", {"files": records})


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", choices=("all", "oisst", "era5"), default="all")
    args = parser.parse_args()

    files: list[Path] = []
    if args.source in ("all", "oisst"):
        files.extend(download_oisst())
    if args.source in ("all", "era5"):
        files.extend(download_era5())
    write_checksums(files)
    print("Updated the untouched-source checksum inventory.")


if __name__ == "__main__":
    main()
