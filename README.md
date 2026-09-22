# TerraTherm — 3D Global Heatmap

An interactive 3D globe prototype for exploring 52 weekly global temperature fields. React coordinates state, D3 drives the semantic temperature legend, and Three.js handles climate textures, raycasting, temporal interpolation, and GPU range filtering.

## Run locally

```bash
npm install
npm run generate:data
npm run dev
```

The data generator creates the canonical `1440 × 720` land mask and 104 raw `Uint16` weekly binary grids in `public/data/2025` (about 208 MiB). Generated fields are synthetic and intended to validate the interface and rendering architecture—not for scientific interpretation. Replace the generator's fields with processed ERA5 and NOAA OISST rasters while retaining the manifest and binary encoding.

## Architecture

- Numeric temperature fields remain in CPU `Uint16Array`s for instant tooltip lookup and GPU textures for display.
- Legend hover only updates shader uniforms; it never scans the million-cell raster.
- The fragment shader composites land air temperature with ocean SST, uses a fixed annual lookup table, and interpolates adjacent weekly textures.
- Country borders and coastlines are separate Natural Earth vector overlays.
- The adjacent-frame cache retains a small five-frame LRU and prefetches playback neighbors.

## Encoding

`temperatureC = encoded × 0.01 − 100`; `65535` is missing and `65534` is reserved. Grid rows run north-to-south, columns west-to-east, and `index = row × 1440 + column`.
