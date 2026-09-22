# TerraTherm

TerraTherm is a strict TypeScript climate-visualization application for exploring 52 synthetic weekly temperature fields on a 3D globe. It coordinates a D3 area-weighted temperature legend with a single Three.js shader-rendered sphere.

> The bundled 2025 fields are deterministic synthetic architecture fixtures. They are not ERA5 or NOAA OISST observations and must not be used for scientific analysis.

## Architecture

- `src/climate` owns the canonical 1440 × 720 grid, temperature encoding, runtime manifest validation, explicit little-endian binary parsing, URL construction, frame loading, in-flight deduplication, and five-frame LRU cache.
- `src/globe` owns R3F rendering, numeric data textures, shader interpolation and filtering, CPU hover lookup, tooltips, and independent vector overlays.
- `src/legend` owns the shared annual palette, D3 scale and histogram path, pointer inversion, keyboard interaction, and mode-consistent percentage calculations.
- `src/app` owns semantic application state and atomic frame transitions. React is not updated from the render loop.
- `scripts/generate-data.ts` explicitly regenerates the deterministic local fixtures. It is never run by install, test, or build.

The CPU answers which cell and temperature the user points to. The GPU answers where the selected temperature occurs globally.

## Display semantics

- **Composite:** synthetic 2 m air temperature over land plus synthetic sea-surface temperature over ocean; uses the combined histogram.
- **Air · land:** synthetic 2 m air temperature on land; ocean is intentionally shown as unsupported; uses the land histogram.
- **Sea:** synthetic sea-surface temperature over ocean; land is intentionally shown as unsupported; uses the ocean histogram.

All modes share a fixed −80 °C to +60 °C annual color scale.

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

`npm run generate:data` overwrites the annual fixtures and should only be run deliberately. Ordinary development, testing, and builds use the checked-in files under `public/data/2025`.

## Data contract

Each temperature raster contains 1,036,800 little-endian `Uint16` values (2,073,600 bytes). Values use `temperatureC = encoded × 0.01 − 100`; `65534` is reserved and `65535` is missing. The land/ocean mask contains 1,036,800 `Uint8` values, where `0` is ocean and `1` is land.
