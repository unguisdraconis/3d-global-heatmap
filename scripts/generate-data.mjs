import { mkdir, writeFile, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { feature } from 'topojson-client';
import { geoContains } from 'd3-geo';

const require = createRequire(import.meta.url);
const topology = require('world-atlas/countries-110m.json');
const land = feature(topology, topology.objects.land);
const WIDTH = 1440;
const HEIGHT = 720;
const SIZE = WIDTH * HEIGHT;
const MISSING = 65535;
const MIN = -80;
const MAX = 60;
const BIN_WIDTH = 0.5;
const BIN_COUNT = (MAX - MIN) / BIN_WIDTH;
const ROOT = path.resolve('public/data/2025');

const encode = (temperature) => Math.max(0, Math.min(65533, Math.round((temperature + 100) * 100)));
const iso = (date) => date.toISOString().slice(0, 10);

async function generateMask() {
  const file = path.join(ROOT, 'land-mask.bin');
  try {
    await access(file);
    const bytes = await import('node:fs/promises').then(({ readFile }) => readFile(file));
    if (bytes.length === SIZE) return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  } catch { /* create below */ }

  console.log('Rasterizing Natural Earth land mask…');
  const mask = new Uint8Array(SIZE);
  // Natural Earth is sampled at 0.5° and expanded to 0.25°. This keeps generation
  // quick while retaining canonical dimensions and direct cell indexing.
  for (let row = 0; row < HEIGHT; row += 2) {
    const lat = 89.75 - row * 0.25;
    for (let col = 0; col < WIDTH; col += 2) {
      const lon = -179.75 + col * 0.25;
      const value = geoContains(land, [lon, lat]) ? 1 : 0;
      mask[row * WIDTH + col] = value;
      mask[row * WIDTH + col + 1] = value;
      if (row + 1 < HEIGHT) {
        mask[(row + 1) * WIDTH + col] = value;
        mask[(row + 1) * WIDTH + col + 1] = value;
      }
    }
    if (row % 80 === 0) process.stdout.write('.');
  }
  process.stdout.write('\n');
  await writeFile(file, mask);
  return mask;
}

function precomputeClimateShape(mask) {
  const baseAir = new Float32Array(SIZE);
  const baseSst = new Float32Array(SIZE);
  const seasonal = new Float32Array(SIZE);
  const areaWeight = new Float32Array(HEIGHT);
  for (let row = 0; row < HEIGHT; row += 1) {
    const lat = 89.875 - row * 0.25;
    const latRad = lat * Math.PI / 180;
    const absLat = Math.abs(lat);
    areaWeight[row] = Math.max(0, Math.cos(latRad));
    for (let col = 0; col < WIDTH; col += 1) {
      const index = row * WIDTH + col;
      const lon = -179.875 + col * 0.25;
      const lonRad = lon * Math.PI / 180;
      const continental = Math.sin(lonRad * 2.7 + latRad * 1.3) * Math.cos(latRad * 2.2);
      const terrain = mask[index] ? (Math.sin(lonRad * 7.0) * Math.sin(latRad * 5.0) + Math.cos(lonRad * 3.0 - latRad * 4.0)) * 2.2 : 0;
      baseAir[index] = 30.5 - absLat * 0.78 + continental * 3.2 - terrain;
      baseSst[index] = 29.0 - Math.pow(absLat / 90, 1.35) * 34 + continental * 1.1;
      seasonal[index] = Math.sign(lat || 1) * (3.0 + Math.pow(absLat / 90, 1.2) * (mask[index] ? 18 : 7));
    }
  }
  return { baseAir, baseSst, seasonal, areaWeight };
}

function addHistogram(hist, temperature, weight) {
  const bin = Math.floor((temperature - MIN) / BIN_WIDTH);
  if (bin >= 0 && bin < BIN_COUNT) hist[bin] += weight;
}

function roundHistogram(values) {
  return Array.from(values, (value) => Math.round(value * 1000) / 1000);
}

async function main() {
  await mkdir(path.join(ROOT, 'air'), { recursive: true });
  await mkdir(path.join(ROOT, 'sst'), { recursive: true });
  const mask = await generateMask();
  const shape = precomputeClimateShape(mask);
  const frames = [];

  console.log('Generating 52 canonical weekly fields…');
  for (let week = 0; week < 52; week += 1) {
    const air = new Uint16Array(SIZE);
    const sst = new Uint16Array(SIZE);
    const landHistogram = new Float64Array(BIN_COUNT);
    const oceanHistogram = new Float64Array(BIN_COUNT);
    const combinedHistogram = new Float64Array(BIN_COUNT);
    let landMin = Infinity, landMax = -Infinity, oceanMin = Infinity, oceanMax = -Infinity;
    let landArea = 0, oceanArea = 0;
    const phase = Math.cos(((week + 0.5) / 52) * Math.PI * 2);
    const oceanPhase = Math.cos((((week + 0.5) / 52) * Math.PI * 2) - 0.45);
    for (let row = 0; row < HEIGHT; row += 1) {
      const weight = shape.areaWeight[row];
      for (let col = 0; col < WIDTH; col += 1) {
        const index = row * WIDTH + col;
        const airValue = shape.baseAir[index] + shape.seasonal[index] * phase;
        const sstValue = shape.baseSst[index] + shape.seasonal[index] * 0.48 * oceanPhase;
        air[index] = encode(airValue);
        if (mask[index]) {
          sst[index] = MISSING;
          landMin = Math.min(landMin, airValue); landMax = Math.max(landMax, airValue); landArea += weight;
          addHistogram(landHistogram, airValue, weight); addHistogram(combinedHistogram, airValue, weight);
        } else {
          sst[index] = encode(sstValue);
          oceanMin = Math.min(oceanMin, sstValue); oceanMax = Math.max(oceanMax, sstValue); oceanArea += weight;
          addHistogram(oceanHistogram, sstValue, weight); addHistogram(combinedHistogram, sstValue, weight);
        }
      }
    }
    const id = `week-${String(week).padStart(2, '0')}`;
    await Promise.all([
      writeFile(path.join(ROOT, 'air', `${id}.bin`), Buffer.from(air.buffer)),
      writeFile(path.join(ROOT, 'sst', `${id}.bin`), Buffer.from(sst.buffer)),
    ]);
    const start = new Date(Date.UTC(2025, 0, 1 + week * 7));
    const end = new Date(Date.UTC(2025, 0, week === 51 ? 365 : 7 + week * 7));
    const representative = new Date((start.getTime() + end.getTime()) / 2);
    frames.push({
      id, frame: week, startDate: iso(start), endDate: iso(end), representativeDate: iso(representative), observations: week === 51 ? 8 : 7,
      air: `air/${id}.bin`, sst: `sst/${id}.bin`,
      minimums: { land: +landMin.toFixed(2), ocean: +oceanMin.toFixed(2), combined: +Math.min(landMin, oceanMin).toFixed(2) },
      maximums: { land: +landMax.toFixed(2), ocean: +oceanMax.toFixed(2), combined: +Math.max(landMax, oceanMax).toFixed(2) },
      histograms: { binMinimum: MIN, binWidth: BIN_WIDTH, areaTotal: +(landArea + oceanArea).toFixed(3), landArea: +landArea.toFixed(3), oceanArea: +oceanArea.toFixed(3), land: roundHistogram(landHistogram), ocean: roundHistogram(oceanHistogram), combined: roundHistogram(combinedHistogram) },
    });
    process.stdout.write(`${String(week + 1).padStart(2, '0')}${week === 51 ? '\n' : ' '}`);
  }

  const manifest = {
    schemaVersion: '1.0.0', prototypeVersion: '0.1.0', created: new Date().toISOString(), year: 2025,
    notice: 'Synthetic demonstration fields. Replace with processed ERA5 and NOAA OISST data for scientific use.',
    grid: { width: WIDTH, height: HEIGHT, cellCount: SIZE, resolution: 0.25, latitudeOrigin: 89.875, longitudeOrigin: -179.875, rowDirection: 'north-to-south', columnDirection: 'west-to-east', index: 'row * 1440 + column' },
    encoding: { type: 'Uint16', byteOrder: 'little-endian', scale: 0.01, offset: -100, missing: MISSING, reserved: 65534, units: 'degrees Celsius' },
    legend: { minimum: MIN, maximum: MAX, histogramBinWidth: BIN_WIDTH, histogramBinCount: BIN_COUNT, fixedAnnualScale: true },
    sources: { land: { dataset: 'ERA5-style synthetic field', variable: '2 m air temperature' }, ocean: { dataset: 'OISST-style synthetic field', variable: 'sea-surface temperature' }, units: '°C' },
    mask: { filename: 'land-mask.bin', type: 'Uint8', ocean: 0, land: 1, source: 'Natural Earth 1:110m sampled to canonical grid' },
    frames,
  };
  await writeFile(path.join(ROOT, 'manifest.json'), `${JSON.stringify(manifest)}\n`);
  console.log(`Done. Wrote ${frames.length * 2} temperature grids to ${ROOT}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
