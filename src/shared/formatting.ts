import type { TemperatureUnit } from '../climate/types';
import { celsiusToDisplay } from '../climate/temperature';

export function formatCoordinate(value: number, positive: string, negative: string): string {
  return `${Math.abs(value).toFixed(2)}° ${value >= 0 ? positive : negative}`;
}

export function formatDateRange(start: string, end: string): string {
  const first = new Date(`${start}T12:00:00Z`); const last = new Date(`${end}T12:00:00Z`);
  const month = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
  if (first.getUTCMonth() === last.getUTCMonth()) return `${month.format(first)} ${first.getUTCDate()}–${last.getUTCDate()}, ${last.getUTCFullYear()}`;
  return `${month.format(first)} ${first.getUTCDate()} – ${month.format(last)} ${last.getUTCDate()}, ${last.getUTCFullYear()}`;
}

export function formatTemperature(valueC: number | null, unit: TemperatureUnit): string {
  return valueC === null ? 'No data' : `${celsiusToDisplay(valueC, unit).toFixed(2)} °${unit}`;
}

