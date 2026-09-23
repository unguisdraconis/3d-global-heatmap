import { useEffect, useState } from 'react';
import { CalendarDays, CircleHelp, RotateCcw } from 'lucide-react';
import { useClimateExplorer } from './useClimateExplorer';
import { Globe } from '../globe/Globe';
import { GlobeTooltip } from '../globe/GlobeTooltip';
import { TemperatureLegend } from '../legend/TemperatureLegend';
import { DisplayModeControl } from '../controls/DisplayModeControl';
import { RenderStyleControl } from '../controls/RenderStyleControl';
import { TimelineControl } from '../controls/TimelineControl';
import { UnitControl } from '../controls/UnitControl';
import { LayerControl } from '../controls/LayerControl';
import { formatDateRange } from '../shared/formatting';
import { TemperiesMark } from '../shared/TemperiesMark';
import { classifyClimateManifest } from '../climate/dataset';

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const query = window.matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setReduced(query.matches); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []);
  return reduced;
}

function LoadingScreen({ error }: { error?: string }) {
  return <main className="loading-screen" role={error ? 'alert' : 'status'}><div className="loader-orbit"><TemperiesMark size={43} /></div>
    <h1>{error ? 'Data unavailable' : 'Warming up the planet'}</h1><p>{error ?? 'Validating the manifest and loading canonical 0.25° grids…'}</p>
    {error && <button onClick={() => window.location.reload()}>Try again</button>}</main>;
}

export default function App() {
  const { state, actions, highlight } = useClimateExplorer();
  const [aboutOpen, setAboutOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  if (state.fatalError) return <LoadingScreen error={state.fatalError} />;
  if (!state.manifest || !state.mask || !state.framePair) return <LoadingScreen />;

  const { manifest, framePair } = state;
  const frame = framePair.currentMeta;
  const datasetKind = classifyClimateManifest(manifest);
  const isReference = datasetKind === 'real-reference';
  const isSynthetic = datasetKind === 'synthetic';
  const aboutHeading = isSynthetic ? 'Synthetic architecture fixture' : isReference ? 'Verified real-data reference' : 'Validated 2025 climate data';
  const sceneDescription = isSynthetic
    ? 'One year of synthetic planetary surface conditions, mapped at quarter-degree resolution.'
    : isReference
      ? 'One verified week of ERA5 and NOAA OISST conditions, mapped at quarter-degree resolution.'
      : 'One year of ERA5 reanalysis and NOAA OISST conditions, mapped at quarter-degree resolution.';
  const readyLabel = isSynthetic ? 'SYNTHETIC DATA READY' : isReference ? 'REAL REFERENCE READY' : 'REAL 2025 DATA READY';
  const footerLabel = isSynthetic ? 'SYNTHETIC TEST DATA' : isReference ? 'REAL REFERENCE DATA' : 'REAL 2025 DATA';
  const dateRange = formatDateRange(frame.startDate, frame.endDate);
  const modeLabel = state.mode === 'composite' ? 'Surface composite' : state.mode === 'air' ? 'Land air temperature' : 'Ocean sea surface';
  const transitioning = state.loadState.status === 'loading' && state.loadState.retainingFrame;
  const loadingWeek = state.loadState.status === 'loading' ? state.loadState.requestedWeek : null;
  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark"><TemperiesMark size={37} /></span><div><strong>TEMPERIES</strong><small>GLOBAL CLIMATE OBSERVATORY</small></div></div>
      <nav aria-label="Primary"><button className="nav-active" aria-current="page">Explorer</button><button onClick={() => setAboutOpen((open) => !open)} aria-expanded={aboutOpen}>About the data</button><button aria-label="Help" onClick={() => setAboutOpen(true)}><CircleHelp size={19} /></button></nav></header>
    {aboutOpen && <aside className="data-notice" role="note"><button aria-label="Close data information" onClick={() => setAboutOpen(false)}>×</button><blockquote className="about-epigraph" lang="la">temperie blandarum captus aquarum<cite>Ovid, Metamorphoses IV</cite></blockquote><strong>{aboutHeading}</strong><p>{manifest.notice}</p><p>Land: {manifest.sources.land.dataset}, {manifest.sources.land.variable}. Ocean: {manifest.sources.ocean.dataset}, {manifest.sources.ocean.variable}.</p></aside>}
    <section className="workspace"><div className="scene-panel"><div className="scene-glow" />
      <Globe frames={framePair} mask={state.mask} mode={state.mode} renderStyle={state.renderStyle} highlight={highlight} vectorLayers={state.vectorLayers}
        reducedMotion={reducedMotion} onHover={actions.setHoveredCell} onLeave={() => actions.setHoveredCell(null)} />
      {transitioning && loadingWeek !== null && <div className="field-loading-notice" role="status" aria-live="polite">
        <span className="field-loading-spinner" aria-hidden="true" />
        <span><strong>Loading temperature data</strong><small>Preparing week {String(loadingWeek + 1).padStart(2, '0')}</small></span>
      </div>}
      <div className="scene-title"><span className="eyebrow">WEEKLY MEAN · {manifest.year}</span><h1>Earth, in temperature.</h1><p>{sceneDescription}</p></div>
      <div className="status-pill"><i /> {transitioning ? 'LOADING FIELD' : readyLabel} <span>{manifest.grid.cellCount.toLocaleString()} CELLS</span></div>
      <div className="globe-hint"><RotateCcw size={15} /> DRAG TO ROTATE · SCROLL TO ZOOM</div>
      <LayerControl layers={state.vectorLayers} onToggle={actions.toggleVectorLayer} />
      {state.hoveredCell && <GlobeTooltip cell={state.hoveredCell} mode={state.mode} unit={state.unit} manifest={manifest} frame={frame} />}
      {state.loadState.status === 'error' && state.loadState.recoverable && <div className="recoverable-error" role="alert">{state.loadState.message}<button onClick={() => actions.requestWeek(state.week)}>Retry</button></div>}
    </div>
      <aside className="control-panel"><DisplayModeControl value={state.mode} onChange={actions.setMode} />
        <RenderStyleControl value={state.renderStyle} onChange={actions.setRenderStyle} />
        <section className="date-section"><div><span className="eyebrow">CURRENT PERIOD</span><h2>{dateRange}</h2><p>Week {String(state.week + 1).padStart(2, '0')} of {manifest.frames.length} <b>·</b> {modeLabel}</p></div><CalendarDays size={21} /></section>
        <TimelineControl week={state.week} frameCount={manifest.frames.length} loading={transitioning} onWeek={actions.requestWeek} />
        <div className="fact-row"><div><span>GRID</span><strong>{manifest.grid.resolution}°</strong></div><div><span>FRAME</span><strong>{String(state.week + 1).padStart(2, '0')} / {manifest.frames.length}</strong></div><div><span>UNITS</span><UnitControl unit={state.unit} onChange={actions.setUnit} /></div></div>
      </aside></section>
    <TemperatureLegend histograms={frame.histograms} mode={state.mode} unit={state.unit} globeValue={state.hoveredCell?.temperatureC ?? null}
      hover={state.legendHover} locked={state.legendLocked} onHover={actions.setLegendHover} onLock={actions.setLegendLock} />
    <footer><span><i /> {footerLabel}</span><p>Land: {manifest.sources.land.dataset} · Ocean: {manifest.sources.ocean.dataset} · Local static binaries</p><p>TEMPERIES TELLURIS</p></footer>
  </main>;
}
