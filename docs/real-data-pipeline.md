# Real-data reference pipeline

This pipeline first validates a reference week, then produces the complete 2025
weekly dataset. The trial period is January 1–7, 2025.

## Sources

- Land air temperature: Copernicus ERA5 post-processed daily statistics, daily
  mean 2 m temperature, UTC, using all 24 hourly observations. The current CDS
  service returns this request as a direct NetCDF file; ZIP responses are also
  accepted by the processor.
- Ocean temperature: NOAA OISST v2.1 AVHRR, seven daily 0.25-degree files.

OISST already uses the required 0.25-degree cell centers and is only reordered.
ERA5 values are bilinearly sampled from its grid points onto the same canonical
cell centers. The invariant OISST valid-data footprint is the authoritative
surface-routing mask: OISST-valid cells use SST, while every other cell uses ERA5
2 m air temperature. The processor rejects any daily OISST file whose footprint
differs from the reference mask. Natural Earth remains a vector-overlay source
and does not decide which climate variable supplies a raster cell.

## One-time setup on Windows

The project-local environment uses the installed Python 3.13 runtime:

```powershell
C:\Users\jerem\AppData\Local\Programs\Python\Python313\python.exe -m venv .venv-data
.venv-data\Scripts\python.exe -m pip install -r requirements-data.txt
```

For ERA5, sign in to the Climate Data Store, accept the dataset terms, and follow
the private API setup shown at <https://cds.climate.copernicus.eu/how-to-api>.
Store the credentials in `%USERPROFILE%\.cdsapirc`; never commit or paste that
file into project documentation.

## Run the reference trial

```powershell
.venv-data\Scripts\python.exe scripts\real_data\download_reference_week.py --source oisst
.venv-data\Scripts\python.exe scripts\real_data\download_reference_week.py --source era5
.venv-data\Scripts\python.exe scripts\real_data\process_reference_week.py --source all --publish-preview
.venv-data\Scripts\python.exe -m unittest discover scripts\real_data\tests
```

Untouched downloads are placed under `untouched_data/2025/week-00` and ignored
by Git. The encoded trial rasters and audit report are placed under
`validation_data/2025/week-00`, also ignored by Git. The pipeline does not write
to `public/data`.

Each output is a 1440 × 720 little-endian Uint16 raster using the app's existing
0.01 °C scale, −100 °C offset, and 65535 missing sentinel. The validation report
records source/output SHA-256 checksums, extrema, valid-cell counts, sample values,
maximum quantization error, exact composite coverage, and comparison with the
legacy Natural Earth classification. `validation_data/2025/surface-mask.bin` is a
1440 × 720 Uint8 raster where `0` selects OISST and `1` selects ERA5 air.

`--publish-preview` creates an ignored, reproducible Vite dataset under
`public/real-reference/data/2025`. It does not replace `public/data/2025`. Open
the application with `?dataset=real-reference` to inspect the reference week;
omit the query parameter to use the promoted real annual dataset.

The original synthetic year is also preserved independently under
`public/synthetic/data/2025` and can be opened with `?dataset=synthetic`. The
complete real year is staged under `public/real-2025/data/2025` and selected with
`?dataset=real-2025`. The validated annual result is also promoted to the default
`public/data/2025`; the synthetic route remains independent for regression tests.
The synthetic folder is intentionally ignored because its 52 weeks are large,
deterministic fixtures. Run `npm run generate:data` to recreate it in that same
separate folder after a fresh clone.

## Complete 2025 build

```powershell
.venv-data\Scripts\python.exe scripts\real_data\download_year.py --source all --workers 8
.venv-data\Scripts\python.exe scripts\real_data\process_year.py --publish-preview
```

The annual downloader is resumable. It stores 365 daily OISST files and 12
monthly ERA5 daily-statistics files under `untouched_data/2025/annual`, then
records a SHA-256 inventory. The processor requires every 2025 date, asserts
that the OISST support mask remains invariant for all 365 days, and produces 51
seven-day frames plus the final eight-day frame. Validated outputs remain under
`validation_data/2025/annual`; the ignored browser preview is selected with
`?dataset=real-2025`.

Promotion copies the validated annual manifest, surface mask, and 104 weekly
temperature rasters into `public/data/2025` only after the complete validation
report passes. The separate synthetic archive must exist before promotion.
