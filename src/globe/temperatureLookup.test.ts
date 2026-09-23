import { describe, expect, it } from 'vitest';
import { GRID } from '../climate/constants';
import { encodeTemperatureC } from '../climate/temperature';
import type { DecodedFrame } from '../climate/types';
import { lookupTemperatureAtIndex } from './temperatureLookup';

function field(value: number): Uint16Array {
  const result = new Uint16Array(GRID.cellCount); result[0] = encodeTemperatureC(value); return result;
}
const current: DecodedFrame = { id: 'current', air: field(10), sst: field(20) };
const next: DecodedFrame = { id: 'next', air: field(14), sst: field(24) };

describe('canonical tooltip lookup', () => {
  it('uses exact typed-array values independently of render style', () => {
    const landMask = new Uint8Array(GRID.cellCount); landMask[0] = 1;
    expect(lookupTemperatureAtIndex({ current, next }, landMask, 'composite', 0, 0.5)).toEqual({ surface: 'land', temperatureC: 12 });
    expect(lookupTemperatureAtIndex({ current, next }, landMask, 'air', 0, 0.5).temperatureC).toBe(12);
    expect(lookupTemperatureAtIndex({ current, next }, landMask, 'sst', 0, 0.5).temperatureC).toBeNull();
  });
  it('preserves ocean SST and land/ocean display-mode semantics', () => {
    const oceanMask = new Uint8Array(GRID.cellCount);
    expect(lookupTemperatureAtIndex({ current, next }, oceanMask, 'composite', 0, 0.5)).toEqual({ surface: 'ocean', temperatureC: 22 });
    expect(lookupTemperatureAtIndex({ current, next }, oceanMask, 'air', 0, 0.5).temperatureC).toBeNull();
  });
  it('rejects non-canonical lookup inputs', () => {
    expect(() => lookupTemperatureAtIndex({ current, next }, new Uint8Array(1), 'composite', 0, 0)).toThrow(/mask/);
    expect(() => lookupTemperatureAtIndex({ current, next }, new Uint8Array(GRID.cellCount), 'composite', GRID.cellCount, 0)).toThrow(/index/);
  });
});

