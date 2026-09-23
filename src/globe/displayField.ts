import { ENCODING, GRID } from '../climate/constants';
import type { DecodedFrame, DisplayMode } from '../climate/types';

export function createDisplayField(frame: DecodedFrame, mask: Uint8Array, mode: DisplayMode): Uint16Array {
  if (mask.length !== GRID.cellCount) throw new RangeError('mask does not match the canonical grid');
  if (frame.air.length !== GRID.cellCount || frame.sst.length !== GRID.cellCount) {
    throw new RangeError('temperature field does not match the canonical grid');
  }

  const result = new Uint16Array(GRID.cellCount);
  for (let index = 0; index < GRID.cellCount; index += 1) {
    const land = mask[index] === 1;
    if (mode === 'composite') result[index] = land ? frame.air[index]! : frame.sst[index]!;
    else if (mode === 'air') result[index] = land ? frame.air[index]! : ENCODING.missing;
    else result[index] = land ? ENCODING.missing : frame.sst[index]!;
  }
  return result;
}

export function createPackedDisplayField(frame: DecodedFrame, mask: Uint8Array, mode: DisplayMode): Uint8Array {
  if (mask.length !== GRID.cellCount) throw new RangeError('mask does not match the canonical grid');
  if (frame.air.length !== GRID.cellCount || frame.sst.length !== GRID.cellCount) {
    throw new RangeError('temperature field does not match the canonical grid');
  }

  const result = new Uint8Array(GRID.cellCount * 2);
  for (let index = 0; index < GRID.cellCount; index += 1) {
    const land = mask[index] === 1;
    let value: number;
    if (mode === 'composite') value = land ? frame.air[index]! : frame.sst[index]!;
    else if (mode === 'air') value = land ? frame.air[index]! : ENCODING.missing;
    else value = land ? ENCODING.missing : frame.sst[index]!;
    const byteIndex = index * 2;
    result[byteIndex] = value & 0xff;
    result[byteIndex + 1] = value >>> 8;
  }
  return result;
}
