import { describe, expect, it } from 'vitest';
import { ENCODING, GRID } from '../climate/constants';
import type { DecodedFrame } from '../climate/types';
import { createDisplayField, createPackedDisplayField } from './displayField';

function fixture(): { frame: DecodedFrame; mask: Uint8Array } {
  const air = new Uint16Array(GRID.cellCount);
  const sst = new Uint16Array(GRID.cellCount);
  const mask = new Uint8Array(GRID.cellCount);
  air.set([10_000, 11_000]);
  sst.set([20_000, 21_000]);
  mask[0] = 1;
  return { frame: { id: 'fixture', air, sst }, mask };
}

describe('GPU display-field composition', () => {
  it('combines land air and ocean SST into one canonical raster', () => {
    const { frame, mask } = fixture();
    const field = createDisplayField(frame, mask, 'composite');
    expect(field[0]).toBe(10_000);
    expect(field[1]).toBe(21_000);
  });
  it('marks unsupported surfaces as missing in single-source modes', () => {
    const { frame, mask } = fixture();
    const air = createDisplayField(frame, mask, 'air');
    const sst = createDisplayField(frame, mask, 'sst');
    expect([air[0], air[1]]).toEqual([10_000, ENCODING.missing]);
    expect([sst[0], sst[1]]).toEqual([ENCODING.missing, 21_000]);
  });
  it('composes and packs a GPU display field in one pass', () => {
    const { frame, mask } = fixture();
    const packed = createPackedDisplayField(frame, mask, 'composite');
    expect([...packed.slice(0, 4)]).toEqual([16, 39, 8, 82]);
    expect(packed).toHaveLength(GRID.cellCount * 2);
  });
  it('rejects non-canonical inputs', () => {
    const { frame } = fixture();
    expect(() => createDisplayField(frame, new Uint8Array(1), 'composite')).toThrow(/mask/);
  });
});
