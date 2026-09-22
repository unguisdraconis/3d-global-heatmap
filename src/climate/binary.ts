import { ENCODING } from './constants';

export function isLittleEndianHost(): boolean {
  const bytes = new Uint8Array(new Uint16Array([0x0102]).buffer);
  return bytes[0] === 0x02;
}

export function parseLittleEndianUint16(buffer: ArrayBuffer, expectedValues: number): Uint16Array {
  const expectedBytes = expectedValues * ENCODING.bytesPerValue;
  if (buffer.byteLength !== expectedBytes) throw new Error(`Expected ${expectedBytes} bytes (${expectedValues} Uint16 values), received ${buffer.byteLength}`);
  if (isLittleEndianHost()) return new Uint16Array(buffer);
  const view = new DataView(buffer);
  const result = new Uint16Array(expectedValues);
  for (let index = 0; index < expectedValues; index += 1) result[index] = view.getUint16(index * 2, true);
  return result;
}

export function parseMask(buffer: ArrayBuffer, expectedValues: number): Uint8Array {
  if (buffer.byteLength !== expectedValues) throw new Error(`Expected ${expectedValues} mask bytes, received ${buffer.byteLength}`);
  const mask = new Uint8Array(buffer);
  for (const value of mask) if (value !== 0 && value !== 1) throw new Error(`Mask contains unsupported value ${value}`);
  return mask;
}

