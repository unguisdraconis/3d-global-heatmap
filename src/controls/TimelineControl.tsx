import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';

interface Props { week: number; frameCount: number; playing: boolean; loading: boolean; reducedMotion: boolean; onWeek: (week: number) => void; onPlaying: (playing: boolean) => void }
export function TimelineControl({ week, frameCount, playing, loading, reducedMotion, onWeek, onPlaying }: Props) {
  return <section className="timeline-section"><div className="timeline-controls">
    <button onClick={() => onWeek(week - 1)} aria-label="Previous week" disabled={loading}><ChevronLeft /></button>
    <button className="play" onClick={() => onPlaying(!playing)} aria-label={playing ? 'Pause annual cycle' : 'Play annual cycle'} disabled={reducedMotion || loading}>
      {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button>
    <button onClick={() => onWeek(week + 1)} aria-label="Next week" disabled={loading}><ChevronRight /></button>
    <span>{reducedMotion ? 'PLAYBACK DISABLED · REDUCED MOTION' : playing ? 'PLAYING · 2.8 SEC / WEEK' : loading ? 'LOADING NEXT FIELD…' : 'PLAY ANNUAL CYCLE'}</span>
  </div>
    <input className="week-range" type="range" min="0" max={frameCount - 1} value={week} onChange={(event) => onWeek(Number(event.target.value))}
      style={{ '--progress': `${week / (frameCount - 1) * 100}%` } as React.CSSProperties} aria-label="Week of year" aria-valuetext={`Week ${week + 1} of ${frameCount}`} />
    <div className="month-row" aria-hidden="true"><span>JAN</span><span>MAR</span><span>MAY</span><span>JUL</span><span>SEP</span><span>NOV</span><span>DEC</span></div>
  </section>;
}

