import { ANNUAL_SCALE, ENCODING, FRAME_COUNT, GRID } from './constants';
import type { ClimateManifest, FrameMetadata } from './types';

type RecordValue = Record<string, unknown>;

function record(value: unknown, label: string): RecordValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as RecordValue;
}
function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} must be a non-empty string`);
  return value;
}
function number(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
  return value;
}
function exact(value: unknown, expected: unknown, label: string): void {
  if (value !== expected) throw new Error(`${label} must be ${String(expected)}`);
}
function isoDate(value: unknown, label: string): string {
  const result = string(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(`${result}T00:00:00Z`))) throw new Error(`${label} must be an ISO date`);
  return result;
}
function isoDateTime(value: unknown, label: string): string {
  const result = string(value, label);
  if (Number.isNaN(Date.parse(result))) throw new Error(`${label} must be an ISO date-time`);
  return result;
}
function binaryPath(value: unknown, label: string): string {
  const result = string(value, label);
  if (result.startsWith('/') || result.includes('..') || !/^[\w/-]+\.bin$/.test(result)) throw new Error(`${label} must be a relative .bin path`);
  return result;
}
function numericArray(value: unknown, length: number, label: string): number[] {
  if (!Array.isArray(value) || value.length !== length || value.some((item) => typeof item !== 'number' || !Number.isFinite(item) || item < 0)) {
    throw new Error(`${label} must contain ${length} non-negative finite values`);
  }
  return value as number[];
}
function extrema(value: unknown, label: string): { land: number; ocean: number; combined: number } {
  const item = record(value, label);
  return { land: number(item.land, `${label}.land`), ocean: number(item.ocean, `${label}.ocean`), combined: number(item.combined, `${label}.combined`) };
}

function frame(value: unknown, expectedIndex: number, histogramLength: number): FrameMetadata {
  const item = record(value, `frames[${expectedIndex}]`);
  const id = string(item.id, `frames[${expectedIndex}].id`);
  const frameIndex = number(item.frame, `${id}.frame`);
  if (!Number.isInteger(frameIndex) || frameIndex !== expectedIndex) throw new Error(`${id}.frame must equal ${expectedIndex}`);
  const hist = record(item.histograms, `${id}.histograms`);
  const startDate = isoDate(item.startDate, `${id}.startDate`);
  const endDate = isoDate(item.endDate, `${id}.endDate`);
  const representativeDate = isoDate(item.representativeDate, `${id}.representativeDate`);
  if (startDate > endDate || representativeDate < startDate || representativeDate > endDate) throw new Error(`${id} contains an invalid date range`);
  return {
    id,
    frame: frameIndex,
    startDate,
    endDate,
    representativeDate,
    observations: number(item.observations, `${id}.observations`),
    air: binaryPath(item.air, `${id}.air`),
    sst: binaryPath(item.sst, `${id}.sst`),
    minimums: extrema(item.minimums, `${id}.minimums`),
    maximums: extrema(item.maximums, `${id}.maximums`),
    histograms: {
      binMinimum: number(hist.binMinimum, `${id}.histograms.binMinimum`),
      binWidth: number(hist.binWidth, `${id}.histograms.binWidth`),
      areaTotal: number(hist.areaTotal, `${id}.histograms.areaTotal`),
      landArea: number(hist.landArea, `${id}.histograms.landArea`),
      oceanArea: number(hist.oceanArea, `${id}.histograms.oceanArea`),
      land: numericArray(hist.land, histogramLength, `${id}.histograms.land`),
      ocean: numericArray(hist.ocean, histogramLength, `${id}.histograms.ocean`),
      combined: numericArray(hist.combined, histogramLength, `${id}.histograms.combined`),
    },
  };
}

export function parseManifest(value: unknown): ClimateManifest {
  const root = record(value, 'manifest');
  exact(root.schemaVersion, '1.0.0', 'schemaVersion');
  const temporalCoverage = root.temporalCoverage === undefined ? 'annual' : string(root.temporalCoverage, 'temporalCoverage');
  if (temporalCoverage !== 'annual' && temporalCoverage !== 'reference') throw new Error('temporalCoverage must be annual or reference');
  const grid = record(root.grid, 'grid');
  exact(grid.width, GRID.width, 'grid.width'); exact(grid.height, GRID.height, 'grid.height');
  exact(grid.cellCount, GRID.cellCount, 'grid.cellCount');
  if (number(grid.cellCount, 'grid.cellCount') !== number(grid.width, 'grid.width') * number(grid.height, 'grid.height')) throw new Error('grid.cellCount must equal width * height');
  exact(grid.resolution, GRID.resolution, 'grid.resolution'); exact(grid.latitudeOrigin, GRID.latitudeOrigin, 'grid.latitudeOrigin');
  exact(grid.longitudeOrigin, GRID.longitudeOrigin, 'grid.longitudeOrigin'); exact(grid.rowDirection, 'north-to-south', 'grid.rowDirection');
  exact(grid.columnDirection, 'west-to-east', 'grid.columnDirection');
  const encoding = record(root.encoding, 'encoding');
  exact(encoding.type, ENCODING.type, 'encoding.type'); exact(encoding.byteOrder, ENCODING.byteOrder, 'encoding.byteOrder');
  exact(encoding.scale, ENCODING.scale, 'encoding.scale'); exact(encoding.offset, ENCODING.offset, 'encoding.offset');
  exact(encoding.missing, ENCODING.missing, 'encoding.missing'); exact(encoding.reserved, ENCODING.reserved, 'encoding.reserved');
  exact(encoding.units, 'degrees Celsius', 'encoding.units');
  const legend = record(root.legend, 'legend');
  exact(legend.minimum, ANNUAL_SCALE.minimum, 'legend.minimum'); exact(legend.maximum, ANNUAL_SCALE.maximum, 'legend.maximum');
  exact(legend.histogramBinWidth, ANNUAL_SCALE.histogramBinWidth, 'legend.histogramBinWidth');
  exact(legend.histogramBinCount, ANNUAL_SCALE.histogramBinCount, 'legend.histogramBinCount'); exact(legend.fixedAnnualScale, true, 'legend.fixedAnnualScale');
  const mask = record(root.mask, 'mask');
  exact(mask.type, 'Uint8', 'mask.type'); exact(mask.ocean, 0, 'mask.ocean'); exact(mask.land, 1, 'mask.land');
  const sources = record(root.sources, 'sources');
  const land = record(sources.land, 'sources.land'); const ocean = record(sources.ocean, 'sources.ocean');
  const expectedFrameCount = temporalCoverage === 'annual' ? FRAME_COUNT : 1;
  if (!Array.isArray(root.frames) || root.frames.length !== expectedFrameCount) throw new Error(`frames must contain exactly ${expectedFrameCount} entries for ${temporalCoverage} coverage`);
  const frames = root.frames.map((item, index) => frame(item, index, ANNUAL_SCALE.histogramBinCount));
  if (new Set(frames.map((item) => item.id)).size !== frames.length) throw new Error('frame IDs must be unique');
  for (const item of frames) {
    if (!Number.isInteger(item.observations) || item.observations < 1) throw new Error(`${item.id}.observations must be a positive integer`);
    if (item.histograms.binMinimum !== ANNUAL_SCALE.minimum || item.histograms.binWidth !== ANNUAL_SCALE.histogramBinWidth) throw new Error(`${item.id}.histograms metadata is incompatible with the annual legend`);
    if (item.histograms.landArea < 0 || item.histograms.oceanArea < 0 || item.histograms.areaTotal <= 0 || Math.abs(item.histograms.landArea + item.histograms.oceanArea - item.histograms.areaTotal) > 0.01) throw new Error(`${item.id}.histograms area totals are inconsistent`);
    if (item.minimums.land > item.maximums.land || item.minimums.ocean > item.maximums.ocean || item.minimums.combined > item.maximums.combined) throw new Error(`${item.id} extrema are inconsistent`);
  }
  const year = number(root.year, 'year');
  if (!Number.isInteger(year)) throw new Error('year must be an integer');
  return {
    schemaVersion: '1.0.0', prototypeVersion: string(root.prototypeVersion, 'prototypeVersion'), temporalCoverage,
    created: isoDateTime(root.created, 'created'), year, notice: string(root.notice, 'notice'),
    grid: { width: GRID.width, height: GRID.height, cellCount: GRID.cellCount, resolution: GRID.resolution,
      latitudeOrigin: GRID.latitudeOrigin, longitudeOrigin: GRID.longitudeOrigin,
      rowDirection: 'north-to-south', columnDirection: 'west-to-east', index: string(grid.index, 'grid.index') },
    encoding: { type: 'Uint16', byteOrder: 'little-endian', scale: ENCODING.scale, offset: ENCODING.offset,
      missing: ENCODING.missing, reserved: ENCODING.reserved, units: 'degrees Celsius' },
    legend: { minimum: ANNUAL_SCALE.minimum, maximum: ANNUAL_SCALE.maximum,
      histogramBinWidth: ANNUAL_SCALE.histogramBinWidth, histogramBinCount: ANNUAL_SCALE.histogramBinCount, fixedAnnualScale: true },
    sources: { land: { dataset: string(land.dataset, 'sources.land.dataset'), variable: string(land.variable, 'sources.land.variable') },
      ocean: { dataset: string(ocean.dataset, 'sources.ocean.dataset'), variable: string(ocean.variable, 'sources.ocean.variable') }, units: string(sources.units, 'sources.units') },
    mask: { filename: binaryPath(mask.filename, 'mask.filename'), type: 'Uint8', ocean: 0, land: 1, source: string(mask.source, 'mask.source') },
    frames,
  };
}
