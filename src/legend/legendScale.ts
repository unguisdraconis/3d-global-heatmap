import { color } from 'd3-color';
import { interpolateRgbBasis } from 'd3-interpolate';
import { scaleLinear } from 'd3-scale';
import { ANNUAL_SCALE } from '../climate/constants';
import type { TemperatureRange, TemperatureUnit } from '../climate/types';
import { celsiusToDisplay } from '../climate/temperature';

const PALETTE = ['#28166f', '#2946b6', '#1c87d2', '#33c3ca', '#8fd28e', '#f3d45a', '#f59b3b', '#e75236', '#a5112d', '#5a061d'];
export const temperatureInterpolator = interpolateRgbBasis(PALETTE);
export const HIGHLIGHT_BAND_HALF_WIDTHS_C = [0.5, 1, 2.5, 5] as const;

export function temperatureColor(valueC: number): string {
  const t = (valueC - ANNUAL_SCALE.minimum) / (ANNUAL_SCALE.maximum - ANNUAL_SCALE.minimum);
  return temperatureInterpolator(Math.min(1, Math.max(0, t)));
}

export function createLutData(size = 512): Uint8Array {
  const bytes = new Uint8Array(size * 4);
  for (let index = 0; index < size; index += 1) {
    const rgb = color(temperatureInterpolator(index / (size - 1)))!.rgb();
    bytes[index * 4] = rgb.r; bytes[index * 4 + 1] = rgb.g; bytes[index * 4 + 2] = rgb.b; bytes[index * 4 + 3] = 255;
  }
  return bytes;
}

export function legendScale(width: number, padding: number) {
  return scaleLinear().domain([ANNUAL_SCALE.minimum, ANNUAL_SCALE.maximum]).range([padding, width - padding]).clamp(true);
}

export function pointerToTemperatureC(pointerX: number, width: number, padding: number): number {
  return legendScale(width, padding).invert(pointerX);
}

export function temperatureFromClientX(
  clientX: number,
  left: number,
  renderedWidth: number,
  renderedHeight: number,
  viewBoxWidth = 760,
  viewBoxHeight = 108,
  padding = 10,
): number {
  // SVG's default xMidYMid meet behavior preserves the viewBox aspect ratio.
  // A wide, fixed-height legend therefore has horizontal letterboxing that is
  // part of getBoundingClientRect(), but not part of the SVG coordinate space.
  const scale = Math.min(renderedWidth / viewBoxWidth, renderedHeight / viewBoxHeight);
  if (!Number.isFinite(scale) || scale <= 0) return ANNUAL_SCALE.minimum;
  const renderedContentWidth = viewBoxWidth * scale;
  const contentLeft = left + (renderedWidth - renderedContentWidth) / 2;
  const viewBoxX = (clientX - contentLeft) / scale;
  return pointerToTemperatureC(viewBoxX, viewBoxWidth, padding);
}

export function rangeAround(valueC: number, halfWidthC: number = HIGHLIGHT_BAND_HALF_WIDTHS_C[0]): TemperatureRange {
  if (!Number.isFinite(halfWidthC) || halfWidthC <= 0) throw new RangeError('highlight half-width must be positive');
  const value = Math.min(ANNUAL_SCALE.maximum, Math.max(ANNUAL_SCALE.minimum, valueC));
  return { value, minimum: Math.max(ANNUAL_SCALE.minimum, value - halfWidthC), maximum: Math.min(ANNUAL_SCALE.maximum, value + halfWidthC) };
}

export function formatLegendValue(valueC: number, unit: TemperatureUnit): string {
  return `${celsiusToDisplay(valueC, unit).toFixed(1)}°${unit}`;
}
