import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FRAME_COUNT, GRID } from './constants';

const manifest = JSON.parse(readFileSync('public/data/2025/manifest.json', 'utf8')) as { mask: { filename: string } };
const maskPath = `public/data/2025/${manifest.mask.filename}`;

describe('checked-in annual data contract', () => {
  it('preserves all 52 frame pairs and their exact byte lengths', () => {
    for (let week = 0; week < FRAME_COUNT; week += 1) {
      const id = `week-${String(week).padStart(2, '0')}.bin`;
      expect(statSync(`public/data/2025/air/${id}`).size).toBe(GRID.cellCount * 2);
      expect(statSync(`public/data/2025/sst/${id}`).size).toBe(GRID.cellCount * 2);
    }
    expect(statSync(maskPath).size).toBe(GRID.cellCount);
  });
  it('does not introduce an ocean discontinuity across the antimeridian', () => {
    const mask = readFileSync(maskPath);
    for (let week = 0; week < FRAME_COUNT; week += 1) {
      const id = `week-${String(week).padStart(2, '0')}.bin`;
      const sst = readFileSync(`public/data/2025/sst/${id}`);
      let differenceTotal = 0; let oceanRows = 0;
      for (let row = 0; row < GRID.height; row += 1) {
        const west = row * GRID.width; const east = west + GRID.width - 1;
        if (mask[west] !== 0 || mask[east] !== 0) continue;
        const westRaw = sst.readUInt16LE(west * 2); const eastRaw = sst.readUInt16LE(east * 2);
        if (westRaw >= 65_534 || eastRaw >= 65_534) continue;
        differenceTotal += Math.abs(westRaw - eastRaw) * 0.01; oceanRows += 1;
      }
      expect(oceanRows, id).toBeGreaterThan(0);
      expect(differenceTotal / oceanRows, id).toBeLessThan(0.1);
    }
  });
  it('does not introduce an ocean discontinuity across the equator', () => {
    const mask = readFileSync(maskPath);
    const northRow = GRID.height / 2 - 1; const southRow = GRID.height / 2;
    for (let week = 0; week < FRAME_COUNT; week += 1) {
      const id = `week-${String(week).padStart(2, '0')}.bin`;
      const sst = readFileSync(`public/data/2025/sst/${id}`);
      let differenceTotal = 0; let oceanCells = 0;
      for (let column = 0; column < GRID.width; column += 1) {
        const north = northRow * GRID.width + column; const south = southRow * GRID.width + column;
        if (mask[north] !== 0 || mask[south] !== 0) continue;
        const northRaw = sst.readUInt16LE(north * 2); const southRaw = sst.readUInt16LE(south * 2);
        if (northRaw >= 65_534 || southRaw >= 65_534) continue;
        differenceTotal += Math.abs(northRaw - southRaw) * 0.01; oceanCells += 1;
      }
      expect(oceanCells, id).toBeGreaterThan(0);
      expect(differenceTotal / oceanCells, id).toBeLessThan(0.15);
    }
  });
});
