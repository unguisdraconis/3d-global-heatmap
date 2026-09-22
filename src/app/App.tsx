import { useEffect, useState } from 'react';
import { CalendarDays, CircleHelp, Globe2, RotateCcw } from 'lucide-react';
import { useClimateExplorer } from './useClimateExplorer';
import { Globe } from '../globe/Globe';
import { GlobeTooltip } from '../globe/GlobeTooltip';
import { TemperatureLegend } from '../legend/TemperatureLegend';
import { DisplayModeControl } from '../controls/DisplayModeControl';
import { TimelineControl } from '../controls/TimelineControl';
import { UnitControl } from '../controls/UnitControl';
import { LayerControl } from '../controls/LayerControl';
import { formatDateRange } from '../shared/formatting';

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const query = window.matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setReduced(query.matches); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []);
  return reduced;
}

function LoadingScreen({ error }: { error?: string }) {
  return <main className="loading-screen" role={error ? 'alert' : 'status'}><div className="loader-orbit"><Globe2 size={31} /></div>
    <h1>{error ? 'Data unavailable' : 'Warming up the planet'}</h1><p>{error ?? 'Validating the manifest and loading canonical 0.25° grids…'}</p>
    {error && <button onClick={() => window.location.reload()}>Try again</button>}</main>;
}

export default function App() {
  const { state, actions, highlight } = useClimateExplorer();
  const [aboutOpen, setAboutOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  if (state.fatalError) return <LoadingScreen error={state.fatalError} />;
  if (!state.manifest || !state.mask || !state.framePair) return <LoadingScreen />;

  const { manifest, framePair } = state; const frame = framePair.currentMeta;
  const dateRange = formatDateRange(frame.startDate, frame.endDate);
  const modeLabel = state.mode === 'composite' ? 'Surface composite' : state.mode === 'air' ? 'Land air temperature' : 'Ocean sea surface';
  const transitioning = state.loadState.status === 'loading' && state.loadState.retainingFrame;
  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark"><Globe2 size={22} strokeWidth={1.7} /></span><div><strong>TERRA<span>THERM</span></strong><small>GLOBAL CLIMATE OBSERVATORY</small></div></div>
      <nav aria-label="Primary"><button className="nav-active" aria-current="page">Explorer</button><button onClick={() => setAboutOpen((open) => !open)} aria-expanded={aboutOpen}>About the data</button><button aria-label="Help" onClick={() => setAboutOpen(true)}><CircleHelp size={19} /></button></nav></header>
    {aboutOpen && <aside className="data-notice" role="note"><button aria-label="Close data information" onClick={() => setAboutOpen(false)}>×</button><strong>Synthetic architecture fixture</strong><p>{manifest.notice}</p><p>Land uses an ERA5-style synthetic 2 m air field; ocean uses an OISST-style synthetic sea-surface field. These are not scientific observations.</p></aside>}
    <section className="workspace"><div className="scene-panel"><div className="scene-glow" />
      <Globe frames={framePair} mask={state.mask} mode={state.mode} highlight={highlight} playing={state.playing} vectorLayers={state.vectorLayers}
        reducedMotion={reducedMotion} onHover={actions.setHoveredCell} onLeave={() => actions.setHoveredCell(null)} onAdvance={actions.advance} />
      <div className="scene-title"><span className="eyebrow">WEEKLY MEAN · {manifest.year}</span><h1>Earth, in temperature.</h1><p>One year of synthetic planetary surface conditions, mapped at quarter-degree resolution.</p></div>
      <div className="status-pill"><i /> {transitioning ? 'LOADING FIELD' : 'LOCAL DATA READY'} <span>{manifest.grid.cellCount.toLocaleString()} CELLS</span></div>
      <div className="globe-hint"><RotateCcw size={15} /> DRAG TO ROTATE · SCROLL TO ZOOM</div>
      <LayerControl layers={state.vectorLayers} onToggle={actions.toggleVectorLayer} />
      {state.hoveredCell && <GlobeTooltip cell={state.hoveredCell} mode={state.mode} unit={state.unit} manifest={manifest} frames={framePair} />}
      {state.loadState.status === 'error' && state.loadState.recoverable && <div className="recoverable-error" role="alert">{state.loadState.message}<button onClick={() => actions.requestWeek(state.week)}>Retry</button></div>}
    </div>
      <aside className="control-panel"><DisplayModeControl value={state.mode} onChange={actions.setMode} />
        <section className="date-section"><div><span className="eyebrow">CURRENT PERIOD</span><h2>{dateRange}</h2><p>Week {String(state.week + 1).padStart(2, '0')} of {manifest.frames.length} <b>·</b> {modeLabel}</p></div><CalendarDays size={21} /></section>
        <TimelineControl week={state.week} frameCount={manifest.frames.length} playing={state.playing} loading={transitioning} reducedMotion={reducedMotion}
          onWeek={actions.requestWeek} onPlaying={actions.setPlaying} />
        <div className="fact-row"><div><span>GRID</span><strong>{manifest.grid.resolution}°</strong></div><div><span>FRAME</span><strong>{String(state.week + 1).padStart(2, '0')} / {manifest.frames.length}</strong></div><div><span>UNITS</span><UnitControl unit={state.unit} onChange={actions.setUnit} /></div></div>
      </aside></section>
    <TemperatureLegend histograms={frame.histograms} mode={state.mode} unit={state.unit} globeValue={state.hoveredCell?.temperatureC ?? null}
      hover={state.legendHover} locked={state.legendLocked} onHover={actions.setLegendHover} onLock={actions.setLegendLock} />
    <footer><span><i /> SYNTHETIC PROTOTYPE DATA</span><p>Land: ERA5-style 2 m air · Ocean: OISST-style sea surface · Local static binaries</p><p>© {manifest.year} TerraTherm Lab</p></footer>
  </main>;
}

