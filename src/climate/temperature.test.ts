import { describe, expect, it } from 'vitest';
import { ENCODING } from './constants';
import { decodeTemperatureC, encodeTemperatureC, isMissingTemperature } from './temperature';
import { parseLittleEndianUint16 } from './binary';

describe('temperature encoding', () => {
  it.each([-80, -40.25, 0, 23.47, 60])('round trips %s°C', (value) => expect(decodeTemperatureC(encodeTemperatureC(value))).toBeCloseTo(value, 2));
  it('quantizes to 0.01°C', () => expect(decodeTemperatureC(encodeTemperatureC(23.474))).toBeCloseTo(23.47, 2));
  it('does not decode sentinel values as temperatures', () => {
    expect(isMissingTemperature(ENCODING.missing)).toBe(true); expect(isMissingTemperature(ENCODING.reserved)).toBe(true);
    expect(decodeTemperatureC(ENCODING.missing)).toBeNull(); expect(decodeTemperatureC(ENCODING.reserved)).toBeNull();
  });
  it('rejects invalid and unrepresentable values', () => {
    expect(() => encodeTemperatureC(Number.NaN)).toThrow(); expect(() => encodeTemperatureC(Infinity)).toThrow();
    expect(() => encodeTemperatureC(-101)).toThrow(); expect(() => encodeTemperatureC(555.34)).toThrow(); expect(() => decodeTemperatureC(1.2)).toThrow();
  });
  it('parses known little-endian byte sequences', () => {
    expect([...parseLittleEndianUint16(new Uint8Array([0x34, 0x12, 0xff, 0x00]).buffer, 2)]).toEqual([0x1234, 0x00ff]);
    expect(() => parseLittleEndianUint16(new ArrayBuffer(3), 2)).toThrow(/Expected 4 bytes/);
  });
});
