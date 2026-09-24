# Temperies

Temperies is a strict TypeScript climate-visualization application for exploring 52 weekly 2025 temperature fields on a 3D globe. It coordinates a D3 area-weighted temperature legend with a single Three.js shader-rendered sphere.

> The default 2025 fields combine Copernicus ERA5 daily-mean 2 m air temperature with NOAA OISST v2.1 daily sea-surface temperature, aggregated into weekly means. ERA5 is a reanalysis product and OISST is an analysis product; neither should be described as direct point observations.
> 
> <img width="1258" height="686" alt="image" src="https://github.com/user-attachments/assets/b38225bb-cd37-4469-a380-d45c0d0f063e" />


## Architecture

- `src/climate` owns the canonical 1440 × 720 grid, temperature encoding, runtime manifest validation, explicit little-endian binary parsing, URL construction, frame loading, in-flight deduplication, and five-frame LRU cache.
- `src/globe` owns R3F rendering, numeric data textures, shader filtering, CPU hover lookup, tooltips, and independent vector overlays.
- `src/legend` owns the shared annual palette, D3 scale and histogram path, pointer inversion, keyboard interaction, and mode-consistent percentage calculations.
- `src/app` owns semantic application state and atomic frame transitions. React is not updated from the render loop.
- `scripts/generate-data.ts` explicitly regenerates the separate deterministic synthetic test dataset. It is never run by install, test, or build.

The CPU answers which cell and temperature the user points to. The GPU answers where the selected temperature occurs globally.

## Display semantics

- **Composite:** ERA5 2 m air temperature outside the invariant OISST ocean footprint plus OISST sea-surface temperature over supported ocean cells; uses the combined histogram.
- **Air · land:** ERA5 2 m air temperature over the air-routed surface mask; ocean is intentionally shown as unsupported; uses the land histogram.
- **Sea:** OISST sea-surface temperature over supported ocean cells; all other cells are intentionally shown as unsupported; uses the ocean histogram.

All modes share a fixed −80 °C to +60 °C annual color scale.

The default **Native grid** rendering style adds derivative-antialiased 0.25° cell boundaries directly in the fragment shader. Boundaries fade when their projected footprint becomes too small, while the authoritative 1440 × 720 nearest-sampled texture remains active at every zoom level. **Clean** hides only those procedural boundaries and uses the same textures and shader pipeline.

## Commands

```bash
npm run dev
npm run build
npm run preview
npm run generate:data
npm run typecheck
npm run lint
npm test
npm run test:watch
```

`npm run generate:data` recreates the isolated synthetic test dataset under `public/synthetic/data/2025`; it does not overwrite the default real dataset. Open that dataset with `?dataset=synthetic`. The validated real year is the checked-in default under `public/data/2025`; `?dataset=real-2025` retains the independently staged copy.

The isolated [real-data pipeline](docs/real-data-pipeline.md) downloads and validates NOAA OISST and Copernicus ERA5 without changing the checked-in default or the separate synthetic test dataset.

## Data contract

Each temperature raster contains 1,036,800 little-endian `Uint16` values (2,073,600 bytes). Values use `temperatureC = encoded × 0.01 − 100`; `65534` is reserved and `65535` is missing. The land/ocean mask contains 1,036,800 `Uint8` values, where `0` is ocean and `1` is land.
