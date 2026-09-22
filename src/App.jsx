import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, CircleHelp, Eye, EyeOff, Globe2, Layers3, Pause, Play, RotateCcw, Waves } from 'lucide-react';
import Globe from './components/Globe';
import TemperatureLegend from './components/TemperatureLegend';
import { loadFrame, loadManifest, loadMask, prefetchFrame } from './lib/dataLoader';
import { formatCoordinate, formatDateRange } from './lib/temperature';

function LoadingScreen({ error }) {
  return <main className="loading-screen"><div className="loader-orbit"><Globe2 size={31} /></div><h1>{error ? 'Data unavailable' : 'Warming up the planet'}</h1><p>{error || 'Loading canonical 0.25° temperature grids…'}</p></main>;
}

export default function App() {
  const [manifest, setManifest] = useState(null);
  const [mask, setMask] = useState(null);
  const [week, setWeek] = useState(1);
  const [frames, setFrames] = useState(null);
  const [mode, setMode] = useState('composite');
  const [playing, setPlaying] = useState(false);
  const [hoverCell, setHoverCell] = useState(null);
  const [highlight, setHighlight] = useState(null);
  const [units, setUnits] = useState('C');
  const [layersOpen, setLayersOpen] = useState(false);
  const [vectorLayers, setVectorLayers] = useState({ countries: true, coastlines: true });
  const [error, setError] = useState(null);

  useEffect(() => { Promise.all([loadManifest(), loadMask()]).then(([m, landMask]) => { setManifest(m); setMask(landMask); }).catch((e) => setError(e.message)); }, []);
  useEffect(() => {
    if (!manifest) return;
    let cancelled = false;
    const currentMeta = manifest.frames[week];
    const nextMeta = manifest.frames[(week + 1) % manifest.frames.length];
    Promise.all([loadFrame(currentMeta), loadFrame(nextMeta)]).then(([current, next]) => {
      if (!cancelled) setFrames({ current, next });
      prefetchFrame(manifest.frames[(week + 2) % manifest.frames.length]);
      prefetchFrame(manifest.frames[(week - 1 + manifest.frames.length) % manifest.frames.length]);
    }).catch((e) => setError(e.message));
    return () => { cancelled = true; };
  }, [manifest, week]);

  const advance = useCallback(() => setWeek((value) => (value + 1) % 52), []);
  const moveWeek = useCallback((delta) => { setPlaying(false); setWeek((value) => (value + delta + 52) % 52); }, []);
  const frame = manifest?.frames[week];
  const displayTemp = hoverCell?.temperature == null ? null : units === 'C' ? hoverCell.temperature : hoverCell.temperature * 9 / 5 + 32;
  const dateRange = frame ? formatDateRange(frame.startDate, frame.endDate) : '';
  const hoverLegendValue = hoverCell?.temperature ?? null;
  const modeLabel = mode === 'composite' ? 'Surface composite' : mode === 'air' ? 'Air temperature' : 'Sea surface';
  const tooltipSource = mode === 'sst' ? 'NOAA OISST sea-surface temperature' : mode === 'air' ? 'ERA5 2 m air temperature' : hoverCell?.land ? 'ERA5 2 m air temperature' : 'NOAA OISST sea-surface temperature';
  const tooltipStyle = hoverCell ? { left: Math.min(window.innerWidth - 245, hoverCell.clientX + 18), top: Math.min(window.innerHeight - 210, hoverCell.clientY + 18) } : undefined;

  if (error || !manifest || !mask || !frames) return <LoadingScreen error={error} />;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Globe2 size={22} strokeWidth={1.7} /></span><div><strong>TERRA<span>THERM</span></strong><small>GLOBAL CLIMATE OBSERVATORY</small></div></div>
        <nav><button className="nav-active">Explorer</button><button onClick={() => alert('This prototype is displaying synthetic climate fields generated locally for architecture validation.')}>About the data</button><button aria-label="Help"><CircleHelp size={19} /></button></nav>
      </header>

      <section className="workspace">
        <div className="scene-panel">
          <div className="scene-glow" />
          <Globe frames={frames} mask={mask} mode={mode} highlight={highlight} playing={playing} vectorLayers={vectorLayers} onHover={setHoverCell} onLeave={() => setHoverCell(null)} onAdvance={advance} />
          <div className="scene-title"><span className="eyebrow">WEEKLY MEAN · 2025</span><h1>Earth, in temperature.</h1><p>One year of planetary surface conditions, mapped at quarter-degree resolution.</p></div>
          <div className="status-pill"><i /> LIVE INTERACTION <span>1,036,800 CELLS</span></div>
          <div className="globe-hint"><RotateCcw size={15} /> DRAG TO ROTATE · SCROLL TO ZOOM</div>

          <div className="layers-wrap">
            <button className={`icon-button ${layersOpen ? 'selected' : ''}`} aria-label="Map layers" onClick={() => setLayersOpen((value) => !value)}><Layers3 size={18} /></button>
            {layersOpen && <div className="layers-popover"><span className="eyebrow">MAP OVERLAYS</span>{Object.entries(vectorLayers).map(([key, value]) => <button key={key} onClick={() => setVectorLayers((layers) => ({ ...layers, [key]: !value }))}>{value ? <Eye size={15} /> : <EyeOff size={15} />} {key[0].toUpperCase() + key.slice(1)}</button>)}</div>}
          </div>

          {hoverCell && <aside className="tooltip" style={tooltipStyle}>
            <div className="tooltip-coords"><span>{formatCoordinate(hoverCell.latitude, 'N', 'S')}</span><span>{formatCoordinate(hoverCell.longitude, 'E', 'W')}</span></div>
            <div className="tooltip-temp"><strong>{displayTemp == null ? 'No data' : `${displayTemp.toFixed(2)}°`}</strong><span>{units}</span></div>
            <p>WEEKLY MEAN</p>
            <dl><div><dt>SURFACE</dt><dd>{hoverCell.land ? 'Land' : 'Ocean'}</dd></div><div><dt>SOURCE</dt><dd>{tooltipSource}</dd></div><div><dt>PERIOD</dt><dd>{dateRange}</dd></div></dl>
          </aside>}
        </div>

        <aside className="control-panel">
          <section className="control-section"><span className="eyebrow">DISPLAY LAYER</span><div className="segmented mode-switch">
            <button className={mode === 'composite' ? 'active' : ''} onClick={() => setMode('composite')}><Globe2 size={15} /> Composite</button>
            <button className={mode === 'air' ? 'active' : ''} onClick={() => setMode('air')}><Eye size={15} /> Air</button>
            <button className={mode === 'sst' ? 'active' : ''} onClick={() => setMode('sst')}><Waves size={15} /> Sea</button>
          </div></section>
          <section className="date-section"><div><span className="eyebrow">CURRENT PERIOD</span><h2>{dateRange}</h2><p>Week {String(week + 1).padStart(2, '0')} of 52 <b>·</b> {modeLabel}</p></div><CalendarDays size={21} /></section>
          <section className="timeline-section">
            <div className="timeline-controls"><button onClick={() => moveWeek(-1)} aria-label="Previous week"><ChevronLeft /></button><button className="play" onClick={() => setPlaying((value) => !value)} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button><button onClick={() => moveWeek(1)} aria-label="Next week"><ChevronRight /></button><span>{playing ? 'PLAYING · 2.8 SEC / WEEK' : 'PLAY ANNUAL CYCLE'}</span></div>
            <input className="week-range" type="range" min="0" max="51" value={week} onChange={(e) => { setPlaying(false); setWeek(Number(e.target.value)); }} style={{ '--progress': `${(week / 51) * 100}%` }} aria-label="Week of year" />
            <div className="month-row"><span>JAN</span><span>MAR</span><span>MAY</span><span>JUL</span><span>SEP</span><span>NOV</span><span>DEC</span></div>
          </section>
          <div className="fact-row"><div><span>GRID</span><strong>0.25°</strong></div><div><span>FRAME</span><strong>{String(week + 1).padStart(2, '0')} / 52</strong></div><div><span>UNITS</span><button onClick={() => setUnits((value) => value === 'C' ? 'F' : 'C')}>°{units}</button></div></div>
        </aside>
      </section>

      <TemperatureLegend histogram={frame.histograms} units={units} hoverValue={hoverLegendValue} range={highlight} onRangeChange={setHighlight} />
      <footer><span><i /> SYNTHETIC PROTOTYPE DATA</span><p>Land: ERA5-style 2 m air · Ocean: OISST-style sea surface · Local static binaries</p><p>© 2025 TerraTherm Lab</p></footer>
    </main>
  );
}
