import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { feature } from 'topojson-client';
import { geoContains } from 'd3-geo';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { GeoPermissibleObjects } from 'd3-geo';
import { ANNUAL_SCALE, DATA_YEAR, ENCODING, FRAME_COUNT, GRID } from '../src/climate/constants';
import type { ClimateManifest, FrameMetadata } from '../src/climate/types';
import { encodeTemperatureC } from '../src/climate/temperature';

const require = createRequire(import.meta.url);
const topology = require('world-atlas/countries-110m.json') as Topology<{ land: GeometryCollection }>;
const land = feature(topology, topology.objects.land) as GeoPermissibleObjects;
const ROOT = path.resolve(`public/synthetic/data/${DATA_YEAR}`);

const iso = (date: Date) => date.toISOString().slice(0, 10);
const round = (value: number) => Math.round(value * 1000) / 1000;
const roundHistogram = (values: Float64Array) => Array.from(values, round);

function littleEndianBytes(values: Uint16Array): Uint8Array {
  const bytes = new Uint8Array(values.length * 2); const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setUint16(index * 2, value, true));
  return bytes;
}

async function generateMask(): Promise<Uint8Array> {
  const file = path.join(ROOT, 'land-mask.bin');
  try { const bytes = await readFile(file); if (bytes.length === GRID.cellCount) return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength); } catch { /* generated below */ }
  console.log('Rasterizing Natural Earth land mask…');
  const mask = new Uint8Array(GRID.cellCount);
  for (let row = 0; row < GRID.height; row += 2) {
    const latitude = 89.75 - row * GRID.resolution;
    for (let column = 0; column < GRID.width; column += 2) {
      const longitude = -179.75 + column * GRID.resolution;
      const value = geoContains(land, [longitude, latitude]) ? 1 : 0;
      mask[row * GRID.width + column] = value; mask[row * GRID.width + column + 1] = value;
      if (row + 1 < GRID.height) { mask[(row + 1) * GRID.width + column] = value; mask[(row + 1) * GRID.width + column + 1] = value; }
    }
    if (row % 80 === 0) process.stdout.write('.');
  }
  process.stdout.write('\n'); await writeFile(file, mask); return mask;
}

function precomputeClimateShape(mask: Uint8Array) {
  const baseAir = new Float32Array(GRID.cellCount); const baseSst = new Float32Array(GRID.cellCount);
  const seasonal = new Float32Array(GRID.cellCount); const areaWeight = new Float32Array(GRID.height);
  for (let row = 0; row < GRID.height; row += 1) {
    const latitude = GRID.latitudeOrigin - row * GRID.resolution; const latitudeRadians = latitude * Math.PI / 180; const absoluteLatitude = Math.abs(latitude);
    areaWeight[row] = Math.max(0, Math.cos(latitudeRadians));
    for (let column = 0; column < GRID.width; column += 1) {
      const index = row * GRID.width + column; const longitude = GRID.longitudeOrigin + column * GRID.resolution; const longitudeRadians = longitude * Math.PI / 180;
      // Longitude harmonics must be whole numbers so the synthetic field is
      // continuous where -180° and +180° meet on the globe.
      const continental = Math.sin(longitudeRadians * 3 + latitudeRadians * 1.3) * Math.cos(latitudeRadians * 2.2);
      const terrain = mask[index] ? (Math.sin(longitudeRadians * 7) * Math.sin(latitudeRadians * 5) + Math.cos(longitudeRadians * 3 - latitudeRadians * 4)) * 2.2 : 0;
      baseAir[index] = 30.5 - absoluteLatitude * 0.78 + continental * 3.2 - terrain;
      baseSst[index] = 29 - Math.pow(absoluteLatitude / 90, 1.35) * 34 + continental * 1.1;
      // Seasonal phase reverses between hemispheres, but must pass smoothly
      // through zero at the equator rather than jumping between adjacent rows.
      seasonal[index] = Math.sin(latitudeRadians) * (3 + Math.pow(absoluteLatitude / 90, 1.2) * (mask[index] ? 18 : 7));
    }
  }
  return { baseAir, baseSst, seasonal, areaWeight };
}

function addHistogram(histogram: Float64Array, temperature: number, weight: number) {
  const bin = Math.floor((temperature - ANNUAL_SCALE.minimum) / ANNUAL_SCALE.histogramBinWidth);
  if (bin >= 0 && bin < ANNUAL_SCALE.histogramBinCount) histogram[bin] = (histogram[bin] ?? 0) + weight;
}

async function main() {
  await mkdir(path.join(ROOT, 'air'), { recursive: true }); await mkdir(path.join(ROOT, 'sst'), { recursive: true });
  const mask = await generateMask(); const shape = precomputeClimateShape(mask); const frames: FrameMetadata[] = [];
  console.log(`Generating ${FRAME_COUNT} canonical weekly fields…`);
  for (let week = 0; week < FRAME_COUNT; week += 1) {
    const air = new Uint16Array(GRID.cellCount); const sst = new Uint16Array(GRID.cellCount);
    const landHistogram = new Float64Array(ANNUAL_SCALE.histogramBinCount); const oceanHistogram = new Float64Array(ANNUAL_SCALE.histogramBinCount); const combinedHistogram = new Float64Array(ANNUAL_SCALE.histogramBinCount);
    let landMinimum = Infinity, landMaximum = -Infinity, oceanMinimum = Infinity, oceanMaximum = -Infinity, landArea = 0, oceanArea = 0;
    const phase = Math.cos((week + 0.5) / FRAME_COUNT * Math.PI * 2); const oceanPhase = Math.cos((week + 0.5) / FRAME_COUNT * Math.PI * 2 - 0.45);
    for (let row = 0; row < GRID.height; row += 1) {
      const weight = shape.areaWeight[row]!;
      for (let column = 0; column < GRID.width; column += 1) {
        const index = row * GRID.width + column;
        const airValue = shape.baseAir[index]! + shape.seasonal[index]! * phase;
        const sstValue = shape.baseSst[index]! + shape.seasonal[index]! * 0.48 * oceanPhase;
        air[index] = encodeTemperatureC(airValue);
        if (mask[index]) {
          sst[index] = ENCODING.missing; landMinimum = Math.min(landMinimum, airValue); landMaximum = Math.max(landMaximum, airValue); landArea += weight;
          addHistogram(landHistogram, airValue, weight); addHistogram(combinedHistogram, airValue, weight);
        } else {
          sst[index] = encodeTemperatureC(sstValue); oceanMinimum = Math.min(oceanMinimum, sstValue); oceanMaximum = Math.max(oceanMaximum, sstValue); oceanArea += weight;
          addHistogram(oceanHistogram, sstValue, weight); addHistogram(combinedHistogram, sstValue, weight);
        }
      }
    }
    const id = `week-${String(week).padStart(2, '0')}`;
    await Promise.all([writeFile(path.join(ROOT, 'air', `${id}.bin`), littleEndianBytes(air)), writeFile(path.join(ROOT, 'sst', `${id}.bin`), littleEndianBytes(sst))]);
    const start = new Date(Date.UTC(DATA_YEAR, 0, 1 + week * 7)); const end = new Date(Date.UTC(DATA_YEAR, 0, week === FRAME_COUNT - 1 ? 365 : 7 + week * 7));
    frames.push({ id, frame: week, startDate: iso(start), endDate: iso(end), representativeDate: iso(new Date((start.getTime() + end.getTime()) / 2)), observations: week === FRAME_COUNT - 1 ? 8 : 7,
      air: `air/${id}.bin`, sst: `sst/${id}.bin`,
      minimums: { land: +landMinimum.toFixed(2), ocean: +oceanMinimum.toFixed(2), combined: +Math.min(landMinimum, oceanMinimum).toFixed(2) },
      maximums: { land: +landMaximum.toFixed(2), ocean: +oceanMaximum.toFixed(2), combined: +Math.max(landMaximum, oceanMaximum).toFixed(2) },
      histograms: { binMinimum: ANNUAL_SCALE.minimum, binWidth: ANNUAL_SCALE.histogramBinWidth, areaTotal: round(landArea + oceanArea), landArea: round(landArea), oceanArea: round(oceanArea), land: roundHistogram(landHistogram), ocean: roundHistogram(oceanHistogram), combined: roundHistogram(combinedHistogram) } });
    process.stdout.write(`${String(week + 1).padStart(2, '0')}${week === FRAME_COUNT - 1 ? '\n' : ' '}`);
  }
  const manifest: ClimateManifest = {
    schemaVersion: '1.0.0', prototypeVersion: '0.2.0', temporalCoverage: 'annual', created: `${DATA_YEAR + 1}-01-01T00:00:00.000Z`, year: DATA_YEAR,
    notice: 'Synthetic demonstration fields. Replace with processed ERA5 and NOAA OISST data for scientific use.',
    grid: { ...GRID, rowDirection: 'north-to-south', columnDirection: 'west-to-east', index: `row * ${GRID.width} + column` },
    encoding: { type: 'Uint16', byteOrder: 'little-endian', scale: ENCODING.scale, offset: ENCODING.offset, missing: ENCODING.missing, reserved: ENCODING.reserved, units: 'degrees Celsius' },
    legend: { ...ANNUAL_SCALE, fixedAnnualScale: true },
    sources: { land: { dataset: 'ERA5-style synthetic field', variable: '2 m air temperature' }, ocean: { dataset: 'OISST-style synthetic field', variable: 'sea-surface temperature' }, units: '°C' },
    mask: { filename: 'land-mask.bin', type: 'Uint8', ocean: 0, land: 1, source: 'Natural Earth 1:110m sampled to canonical grid' }, frames,
  };
  await writeFile(path.join(ROOT, 'manifest.json'), `${JSON.stringify(manifest)}\n`);
  console.log(`Done. Wrote ${frames.length * 2} temperature grids to ${ROOT}`);
}

void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
