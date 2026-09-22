import { describe, expect, it } from 'vitest';
import { GRID } from './constants';
import { gridCellToIndex, gridCellToLatLon, indexToGridCell, latLonToGridCell, normalizeLongitude, uvToGridCell } from './grid';

describe('canonical grid', () => {
  it('maps northern and southern edges without overflow', () => {
    expect(latLonToGridCell(90, -180)).toEqual({ row: 0, column: 0, index: 0 });
    expect(latLonToGridCell(-90, 179.999)).toEqual({ row: 719, column: 1439, index: GRID.cellCount - 1 });
  });
  it('uses one consistent antimeridian seam and wraps longitude', () => {
    expect(latLonToGridCell(0, -180).column).toBe(0);
    expect(latLonToGridCell(0, 180).column).toBe(0);
    expect(normalizeLongitude(540)).toBe(-180);
    expect(normalizeLongitude(-540)).toBe(-180);
  });
  it('has the documented equatorial neighbors', () => {
    expect(gridCellToLatLon(359, 0).latitude).toBe(0.125);
    expect(gridCellToLatLon(360, 0).latitude).toBe(-0.125);
  });
  it('round trips every tested cell center', () => {
    for (const cell of [{ row: 0, column: 0 }, { row: 719, column: 1439 }, { row: 359, column: 720 }]) {
      const coords = gridCellToLatLon(cell.row, cell.column);
      expect(latLonToGridCell(coords.latitude, coords.longitude)).toMatchObject(cell);
    }
  });
  it('maps row/column and index in both directions', () => {
    expect(gridCellToIndex(719, 1439)).toBe(GRID.cellCount - 1);
    expect(indexToGridCell(GRID.cellCount - 1)).toEqual({ row: 719, column: 1439, index: GRID.cellCount - 1 });
  });
  it('clamps all UV boundaries to valid cells', () => {
    expect(uvToGridCell(0, 1)).toEqual({ row: 0, column: 0, index: 0 });
    expect(uvToGridCell(1, 0)).toEqual({ row: 719, column: 1439, index: GRID.cellCount - 1 });
    expect(uvToGridCell(-1, 2).index).toBe(0);
  });
  it('rejects invalid indices, cells, latitude, and non-finite values', () => {
    expect(() => indexToGridCell(-1)).toThrow(RangeError); expect(() => indexToGridCell(GRID.cellCount)).toThrow(RangeError);
    expect(() => gridCellToIndex(720, 0)).toThrow(RangeError); expect(() => gridCellToIndex(0, 1440)).toThrow(RangeError);
    expect(() => latLonToGridCell(90.1, 0)).toThrow(RangeError); expect(() => uvToGridCell(Number.NaN, 0)).toThrow(RangeError);
  });
});

