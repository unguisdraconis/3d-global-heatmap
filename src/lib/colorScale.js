import { color } from 'd3-color';
import { interpolateRgbBasis } from 'd3-interpolate';

export const temperatureInterpolator = interpolateRgbBasis([
  '#28166f', '#2946b6', '#1c87d2', '#33c3ca', '#8fd28e',
  '#f3d45a', '#f59b3b', '#e75236', '#a5112d', '#5a061d',
]);

export function temperatureColor(value, min = -80, max = 60) {
  return temperatureInterpolator(Math.max(0, Math.min(1, (value - min) / (max - min))));
}

export function createLutData(size = 512) {
  const bytes = new Uint8Array(size * 4);
  for (let index = 0; index < size; index += 1) {
    const rgb = color(temperatureInterpolator(index / (size - 1)));
    bytes[index * 4] = rgb.r;
    bytes[index * 4 + 1] = rgb.g;
    bytes[index * 4 + 2] = rgb.b;
    bytes[index * 4 + 3] = 255;
  }
  return bytes;
}
