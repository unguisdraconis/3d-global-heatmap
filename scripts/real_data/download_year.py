"""Resumably download a complete year of untouched OISST and ERA5 daily means."""

from __future__ import annotations

import argparse
import calendar
import os
import shutil
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.request import Request, urlopen

from common import dates_in_year, sha256_file, write_json

YEAR = 2025
PROJECT_ROOT = Path(__file__).resolve().parents[2]
RAW_ROOT = PROJECT_ROOT / "untouched_data" / str(YEAR) / "annual"
REFERENCE_ROOT = PROJECT_ROOT / "untouched_data" / str(YEAR) / "week-00" / "oisst"
OISST_ROOT = (
    "https://www.ncei.noaa.gov/data/sea-surface-temperature-optimum-interpolation/"
    "v2.1/access/avhrr"
)
HDF5_SIGNATURE = b"\x89HDF\r\n\x1a\n"


def valid_netcdf(path: Path) -> bool:
    if not path.is_file() or path.stat().st_size < 1024:
        return False
    with path.open("rb") as source:
        return source.read(8) == HDF5_SIGNATURE


def download(url: str, destination: Path) -> None:
    if valid_netcdf(destination):
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".part")
    request = Request(url, headers={"User-Agent": "TEMPERIES-real-data-pipeline/1.0"})
    with urlopen(request, timeout=180) as response, temporary.open("wb") as target:
        while block := response.read(1024 * 1024):
            target.write(block)
    if not valid_netcdf(temporary):
        raise ValueError(f"Downloaded file is not NetCDF4/HDF5: {destination.name}")
    os.replace(temporary, destination)


def oisst_destination(current) -> Path:
    stamp = current.strftime("%Y%m%d")
    return RAW_ROOT / "oisst" / current.strftime("%Y%m") / f"oisst-avhrr-v02r01.{stamp}.nc"


def seed_reference_files() -> None:
    for current in dates_in_year(YEAR)[:7]:
        destination = oisst_destination(current)
        source = REFERENCE_ROOT / destination.name
        if not valid_netcdf(destination) and valid_netcdf(source):
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)


def download_oisst(workers: int) -> None:
    seed_reference_files()
    pending = []
    for current in dates_in_year(YEAR):
        destination = oisst_destination(current)
        if valid_netcdf(destination):
            continue
        filename = destination.name
        pending.append((f"{OISST_ROOT}/{current:%Y%m}/{filename}", destination))
    print(f"OISST: {365 - len(pending)} present, {len(pending)} to download")
    if not pending:
        return

    completed = 0
    lock = threading.Lock()
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(download, url, destination) for url, destination in pending]
        for future in as_completed(futures):
            future.result()
            with lock:
                completed += 1
                if completed % 25 == 0 or completed == len(pending):
                    print(f"OISST: downloaded {completed}/{len(pending)}")


def has_cds_credentials() -> bool:
    return (Path.home() / ".cdsapirc").is_file() or bool(os.environ.get("CDSAPI_KEY"))


def download_era5() -> None:
    if not has_cds_credentials():
        raise RuntimeError("CDS credentials are not configured in ~/.cdsapirc")
    import cdsapi

    client = cdsapi.Client()
    request_root = RAW_ROOT / "era5" / "requests"
    for month in range(1, 13):
        destination = RAW_ROOT / "era5" / f"era5-2m-temperature-daily-mean-{YEAR}{month:02d}.nc"
        if valid_netcdf(destination):
            print(f"ERA5 {month:02d}: present")
            continue
        request = {
            "product_type": "reanalysis",
            "variable": ["2m_temperature"],
            "year": str(YEAR),
            "month": [f"{month:02d}"],
            "day": [f"{day:02d}" for day in range(1, calendar.monthrange(YEAR, month)[1] + 1)],
            "daily_statistic": "daily_mean",
            "time_zone": "utc+00:00",
            "frequency": "1_hourly",
        }
        write_json(request_root / f"{YEAR}-{month:02d}.json", request)
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_suffix(".nc.part")
        print(f"ERA5 {month:02d}: submitting {len(request['day'])} daily means")
        client.retrieve("derived-era5-single-levels-daily-statistics", request, str(temporary))
        if not valid_netcdf(temporary):
            raise ValueError(f"ERA5 month {month:02d} did not return NetCDF4/HDF5")
        os.replace(temporary, destination)


def write_checksums() -> None:
    files = sorted(RAW_ROOT.rglob("*.nc"))
    records = [
        {
            "path": path.relative_to(PROJECT_ROOT).as_posix(),
            "bytes": path.stat().st_size,
            "sha256": sha256_file(path),
        }
        for path in files
    ]
    write_json(
        RAW_ROOT / "source-checksums.json",
        {
            "year": YEAR,
            "expectedOisstFiles": 365,
            "expectedEra5Files": 12,
            "files": records,
        },
    )
    print(f"Recorded checksums for {len(records)} source files")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", choices=("all", "oisst", "era5"), default="all")
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args()
    if args.workers < 1 or args.workers > 16:
        raise ValueError("--workers must be between 1 and 16")
    if args.source in ("all", "oisst"):
        download_oisst(args.workers)
    if args.source in ("all", "era5"):
        download_era5()
    write_checksums()


if __name__ == "__main__":
    main()
