import { describe, expect, it } from 'vitest';
import type { FrameHistograms } from '../climate/types';
import { celsiusToDisplay } from '../climate/temperature';
import { pointerToTemperatureC, rangeAround, temperatureFromClientX } from './legendScale';
import { histogramForMode, percentageInRange } from './legendStatistics';

const histogram: FrameHistograms = { binMinimum: -80, binWidth: 0.5, areaTotal: 10, landArea: 4, oceanArea: 6,
  land: [1, 3], ocean: [2, 4], combined: [3, 7] };
describe('legend calculations', () => {
  it('inverts pointer position through the fixed Celsius scale', () => {
    expect(pointerToTemperatureC(10, 760, 10)).toBe(-80); expect(pointerToTemperatureC(750, 760, 10)).toBe(60);
  });
  it('removes horizontal SVG letterboxing before inverting the pointer', () => {
    expect(temperatureFromClientX(600, 100, 1000, 72)).toBeCloseTo(-10);
    expect(temperatureFromClientX(353.333333, 100, 1000, 72)).toBeCloseTo(-80);
    expect(temperatureFromClientX(846.666667, 100, 1000, 72)).toBeCloseTo(60);
  });
  it('converts Celsius to Fahrenheit for display only', () => expect(celsiusToDisplay(20, 'F')).toBe(68));
  it('selects mode-appropriate histogram populations', () => {
    expect(histogramForMode(histogram, 'air')).toMatchObject({ bins: histogram.land, area: 4 });
    expect(histogramForMode(histogram, 'sst')).toMatchObject({ bins: histogram.ocean, area: 6 });
  });
  it('calculates percentage for the exact selected interval', () => {
    expect(percentageInRange(histogram, 'composite', { value: -79.75, minimum: -80, maximum: -79.51 })).toBe(30);
    expect(percentageInRange(histogram, 'composite', { value: -79.5, minimum: -80, maximum: -79 })).toBe(100);
    expect(rangeAround(-80)).toEqual({ value: -80, minimum: -80, maximum: -79.5 });
  });
});
