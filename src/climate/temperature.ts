import { ENCODING } from './constants';
import type { TemperatureUnit } from './types';

export function isMissingTemperature(value: number): boolean {
  return value === ENCODING.missing || value === ENCODING.reserved;
}

export function decodeTemperatureC(encoded: number): number | null {
  if (!Number.isInteger(encoded) || encoded < 0 || encoded > 65_535) throw new RangeError('encoded temperature must be an unsigned 16-bit integer');
  return isMissingTemperature(encoded) ? null : encoded * ENCODING.scale + ENCODING.offset;
}

export function encodeTemperatureC(temperatureC: number): number {
  if (!Number.isFinite(temperatureC)) throw new RangeError('temperature must be finite');
  const encoded = Math.round((temperatureC - ENCODING.offset) / ENCODING.scale);
  if (encoded < 0 || encoded >= ENCODING.reserved) throw new RangeError('temperature is outside the representable non-sentinel range');
  return encoded;
}

export function interpolateTemperatureC(a: number, b: number, amount: number): number | null {
  const first = decodeTemperatureC(a);
  const second = decodeTemperatureC(b);
  if (first === null && second === null) return null;
  if (first === null) return second;
  if (second === null) return first;
  return first + (second - first) * Math.min(1, Math.max(0, amount));
}

export function celsiusToDisplay(value: number, unit: TemperatureUnit): number {
  return unit === 'F' ? value * 9 / 5 + 32 : value;
}

export function displayToCelsius(value: number, unit: TemperatureUnit): number {
  return unit === 'F' ? (value - 32) * 5 / 9 : value;
}

