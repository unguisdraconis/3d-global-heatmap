import type { DisplayMode, FrameHistograms, TemperatureRange } from '../climate/types';

export function histogramForMode(histograms: FrameHistograms, mode: DisplayMode): { bins: number[]; area: number; label: string } {
  if (mode === 'air') return { bins: histograms.land, area: histograms.landArea, label: 'land area' };
  if (mode === 'sst') return { bins: histograms.ocean, area: histograms.oceanArea, label: 'ocean area' };
  return { bins: histograms.combined, area: histograms.areaTotal, label: 'displayed surface' };
}

export function percentageInRange(histograms: FrameHistograms, mode: DisplayMode, range: TemperatureRange): number {
  const { bins, area } = histogramForMode(histograms, mode);
  if (area <= 0) return 0;
  const first = Math.max(0, Math.floor((range.minimum - histograms.binMinimum) / histograms.binWidth));
  const last = Math.min(bins.length - 1, Math.ceil((range.maximum - histograms.binMinimum) / histograms.binWidth) - 1);
  let selected = 0;
  for (let index = first; index <= last; index += 1) selected += bins[index] ?? 0;
  return selected / area * 100;
}
