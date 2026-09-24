# Temperies

[![Deploy Temperies](https://github.com/unguisdraconis/temperies/actions/workflows/deploy.yml/badge.svg)](https://github.com/unguisdraconis/temperies/actions/workflows/deploy.yml)

Temperies is an interactive 3D globe for exploring weekly 2025 land-air and sea-surface temperatures. A coordinated D3 legend and Three.js globe let the reader inspect individual quarter-degree cells, select temperature bands, and see where matching conditions occur around the world.

**[Explore the live application](https://unguisdraconis.github.io/temperies/)**

<img width="1258" height="686" alt="Temperies displaying weekly 2025 temperatures on an interactive globe with the coordinated temperature legend and period controls" src="docs/assets/temperies-hero.png" />

> The displayed fields combine Copernicus ERA5 daily-mean 2 m air temperature with NOAA OISST v2.1 daily sea-surface temperature, aggregated into weekly means. ERA5 is a reanalysis product and OISST is an analysis product; neither is a direct point-observation dataset.

## What you can explore

- Hover the globe to inspect a cell's coordinates, surface type, weekly mean temperature, source, and period.
  ![Hover a cell](image.png)
- Hover or select the legend to highlight matching temperatures globally without scanning the raster in JavaScript.
  ![Hover the legend](image-1.png)
- Choose a highlight band of ±0.5 °C, ±1.0 °C, ±2.5 °C, or ±5.0 °C. A locked selection remains active when the period changes.
  ![Choose a highlight band](image-2.png)
- Switch between the land-air and ocean-SST composite, land-air only, and ocean-SST only.
  ![Display layer](image-3.png)
- Jump to the spatial low or high of the selected week's mean field. These are extrema of weekly means, not instantaneous weather records.
  ![Weekly mean low](image-4.png)
- Move through 52 periods covering all 365 days of 2025, with a loading indicator while a requested field is prepared.
  ![Weekly period selector](image-5.png)
- Show or hide borders and coastlines, switch between native-cell and clean rendering, and display temperatures in Celsius or Fahrenheit.
  ![Borders and coastlines removed](image-6.png)

## Scientific scope

- **Composite:** ERA5 2 m air temperature outside the invariant OISST ocean footprint plus OISST sea-surface temperature over supported ocean cells.
- **Air · land:** ERA5 2 m air temperature over the air-routed surface mask; ocean cells are intentionally unsupported.
- **Sea:** OISST sea-surface temperature over supported ocean cells; all other cells are intentionally unsupported.

The composite is a surface overview assembled from two physically different variables. It should not be treated as a single homogeneous observational record or as a climate-change attribution product. All modes use the same fixed −80 °C to +60 °C annual color scale so colors remain comparable between weeks.

The canonical raster is a 1440 × 720 regular latitude–longitude grid with 0.25° cell spacing. The shader converts each sphere fragment to longitude and latitude before sampling the equirectangular raster. Vector borders and coastlines are converted independently from longitude and latitude to spherical geometry.

See [Data sources and methodology](DATA_SOURCES.md) for citations, source terms, processing choices, and interpretation limits. The compact [2025 provenance record](docs/data-provenance-2025.md) preserves validation totals and checksums.

## Architecture

- `src/climate` owns the canonical grid, temperature encoding, runtime manifest validation, explicit little-endian binary parsing, URL construction, frame loading, in-flight deduplication, and five-frame LRU cache.
- `src/globe` owns React Three Fiber rendering, numeric data textures, shader filtering, CPU hover lookup, tooltips, and independent vector overlays.
- `src/legend` owns the shared annual palette, D3 scale and histogram path, pointer inversion, keyboard interaction, and mode-consistent area calculations.
- `src/app` owns semantic application state and atomic frame transitions. Per-frame rendering values do not flow through React state.
- `scripts/real_data` owns source acquisition, canonical-grid alignment, weekly aggregation, encoding, and validation.
- `scripts/generate-data.ts` regenerates a separate deterministic synthetic test dataset. It is never run by install, test, or build.

The CPU determines which cell or temperature the user requests. The GPU determines where the selected temperature occurs globally.

The default **Native grid** style draws derivative-antialiased 0.25° cell boundaries in the fragment shader. Boundaries fade when their projected footprint becomes too small. **Clean** hides only those boundaries and retains the same nearest-sampled climate textures.

## Validation

Every push to `main` runs the following checks before GitHub Pages deployment:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The test suite covers grid edges and seams, binary encoding, manifest rejection, raster dimensions, loading failures and stale requests, LRU behavior, texture configuration, shader contracts, CPU temperature lookup, reducer behavior, and legend pointer and keyboard interaction. These checks do not constitute a formal accessibility audit or a browser-performance benchmark.

The interface includes visible keyboard focus, a keyboard-operable temperature selector, status and error announcements, accessible control names, and reduced-motion handling. No claim of WCAG conformance is made.

## Run locally

Use Node.js 22, matching the deployment workflow.

```bash
npm ci
npm run dev
```

Additional commands:

```bash
npm run build
npm run preview
npm run generate:data
npm run typecheck
npm run lint
npm test
npm run test:watch
```

`npm run generate:data` recreates the isolated synthetic fixture under `public/synthetic/data/2025`; it does not overwrite the default real dataset. Open it with `?dataset=synthetic`. The checked-in default is the validated real dataset under `public/data/2025`.

The [real-data pipeline](docs/real-data-pipeline.md) documents a resumable acquisition and processing workflow for NOAA OISST and Copernicus ERA5. Reproducing the ERA5 acquisition requires a Climate Data Store account and acceptance of the applicable dataset terms.

## Data contract

Each temperature raster contains 1,036,800 little-endian `Uint16` values (2,073,600 bytes). Values use `temperatureC = encoded × 0.01 − 100`; `65534` is reserved and `65535` is missing. The surface-routing mask contains 1,036,800 `Uint8` values, where `0` selects OISST and `1` selects ERA5 air temperature.

## Project role

Temperies was designed and directed by Jeremiah King, including the product concept, interaction decisions, visual direction, climate-data methodology, and validation requirements. Implementation was developed with AI-assisted coding using ChatGPT and Codex. Repository history records the resulting code and documentation but is not, by itself, evidence that every line was independently authored.

## Licensing

The source code is available under the [MIT License](LICENSE).

That licence does **not** apply to the TEMPERIES name, wordmark, logo, favicon, or other brand assets; screenshots or promotional artwork; climate datasets or derived data products; or third-party geographic and software assets. Those materials retain their applicable copyright or source-specific terms.

See [Licensing scope and third-party material](NOTICE.md) for the boundary between MIT-licensed code and excluded material. Climate and map data sources, citations, and terms are documented in [Data sources and methodology](DATA_SOURCES.md).
