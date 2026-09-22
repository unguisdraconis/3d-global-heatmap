import { GRID } from './constants';
import type { GridCell, LatLon } from './types';

function finite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

export function normalizeLongitude(longitude: number): number {
  finite(longitude, 'longitude');
  const wrapped = ((longitude + 180) % 360 + 360) % 360 - 180;
  return Object.is(wrapped, -0) ? 0 : wrapped;
}

export function gridCellToIndex(row: number, column: number): number {
  if (!Number.isInteger(row) || row < 0 || row >= GRID.height) throw new RangeError(`row must be an integer from 0 to ${GRID.height - 1}`);
  if (!Number.isInteger(column) || column < 0 || column >= GRID.width) throw new RangeError(`column must be an integer from 0 to ${GRID.width - 1}`);
  return row * GRID.width + column;
}

export function indexToGridCell(index: number): GridCell {
  if (!Number.isInteger(index) || index < 0 || index >= GRID.cellCount) throw new RangeError(`index must be an integer from 0 to ${GRID.cellCount - 1}`);
  const row = Math.floor(index / GRID.width);
  const column = index % GRID.width;
  return { row, column, index };
}

export function latLonToGridCell(latitude: number, longitude: number): GridCell {
  finite(latitude, 'latitude');
  if (latitude < -90 || latitude > 90) throw new RangeError('latitude must be between -90 and 90 degrees');
  const normalized = normalizeLongitude(longitude);
  const row = Math.min(GRID.height - 1, Math.max(0, Math.floor((90 - latitude) / GRID.resolution)));
  const column = Math.min(GRID.width - 1, Math.max(0, Math.floor((normalized + 180) / GRID.resolution)));
  return { row, column, index: gridCellToIndex(row, column) };
}

export function uvToGridCell(u: number, v: number): GridCell {
  finite(u, 'u'); finite(v, 'v');
  const clampedU = Math.min(1, Math.max(0, u));
  const clampedV = Math.min(1, Math.max(0, v));
  const column = Math.min(GRID.width - 1, Math.floor(clampedU * GRID.width));
  const row = Math.min(GRID.height - 1, Math.floor((1 - clampedV) * GRID.height));
  return { row, column, index: gridCellToIndex(row, column) };
}

export function gridCellToLatLon(row: number, column: number): LatLon {
  gridCellToIndex(row, column);
  return {
    latitude: GRID.latitudeOrigin - row * GRID.resolution,
    longitude: GRID.longitudeOrigin + column * GRID.resolution,
  };
}

