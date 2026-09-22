import { statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FRAME_COUNT, GRID } from './constants';

describe('checked-in annual data contract', () => {
  it('preserves all 52 frame pairs and their exact byte lengths', () => {
    for (let week = 0; week < FRAME_COUNT; week += 1) {
      const id = `week-${String(week).padStart(2, '0')}.bin`;
      expect(statSync(`public/data/2025/air/${id}`).size).toBe(GRID.cellCount * 2);
      expect(statSync(`public/data/2025/sst/${id}`).size).toBe(GRID.cellCount * 2);
    }
    expect(statSync('public/data/2025/land-mask.bin').size).toBe(GRID.cellCount);
  });
});
