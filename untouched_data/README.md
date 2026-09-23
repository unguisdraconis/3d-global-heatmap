# Untouched source data

This directory is the local landing area for original climate-source downloads.
Its downloaded contents are intentionally ignored by Git and must never be
edited in place. The ingestion pipeline records a SHA-256 checksum for every
source file before processing.

For the first reference week, the expected layout is:

```text
untouched_data/
  2025/
    week-00/
      era5/
      oisst/
      source-checksums.json
```

Processed validation artifacts are written separately under
`validation_data/`. The reference-week pipeline never changes production files;
the complete annual dataset is promoted to `public/data/` only after its annual
validation report passes.
