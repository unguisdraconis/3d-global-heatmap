import type { CSSProperties } from 'react';
import type { ClimateManifest, DisplayMode, FramePair, HoveredCell, TemperatureUnit } from '../climate/types';
import { formatCoordinate, formatDateRange, formatTemperature } from '../shared/formatting';

interface Props { cell: HoveredCell; mode: DisplayMode; unit: TemperatureUnit; manifest: ClimateManifest; frames: FramePair }

export function GlobeTooltip({ cell, mode, unit, manifest, frames }: Props) {
  const source = mode === 'sst' ? manifest.sources.ocean : mode === 'air' ? manifest.sources.land : cell.surface === 'land' ? manifest.sources.land : manifest.sources.ocean;
  const variable = mode === 'sst' ? manifest.sources.ocean.variable : mode === 'air' ? manifest.sources.land.variable : source.variable;
  const transitioning = cell.interpolation > 0.01;
  const period = transitioning
    ? `${formatDateRange(frames.currentMeta.startDate, frames.currentMeta.endDate)} → ${formatDateRange(frames.nextMeta.startDate, frames.nextMeta.endDate)}`
    : formatDateRange(frames.currentMeta.startDate, frames.currentMeta.endDate);
  const style: CSSProperties = { left: Math.max(12, Math.min(window.innerWidth - 260, cell.clientX + 18)), top: Math.max(72, Math.min(window.innerHeight - 230, cell.clientY + 18)) };
  return <aside className="tooltip" style={style} aria-live="polite">
    <div className="tooltip-coords"><span>{formatCoordinate(cell.latitude, 'N', 'S')}</span><span>{formatCoordinate(cell.longitude, 'E', 'W')}</span></div>
    <div className="tooltip-temp"><strong>{formatTemperature(cell.temperatureC, unit)}</strong></div>
    <p>{transitioning ? `INTERPOLATED · ${Math.round(cell.interpolation * 100)}%` : 'WEEKLY MEAN'}</p>
    <dl><div><dt>SURFACE</dt><dd>{cell.surface === 'land' ? 'Land' : 'Ocean'}</dd></div><div><dt>VARIABLE</dt><dd>{variable}</dd></div>
      <div><dt>SOURCE</dt><dd>{source.dataset}</dd></div><div><dt>PERIOD</dt><dd>{period}</dd></div></dl>
  </aside>;
}

