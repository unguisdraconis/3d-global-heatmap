import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const TIMELINE_SCRUB_DELAY_MS = 300;

interface Props { week: number; frameCount: number; loading: boolean; onWeek: (week: number) => void }
export function TimelineControl({ week, frameCount, loading, onWeek }: Props) {
  const [displayWeek, setDisplayWeek] = useState(week);
  const targetWeekRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onWeekRef = useRef(onWeek);
  onWeekRef.current = onWeek;

  const clearQueuedRequest = () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => {
    const target = targetWeekRef.current;
    if (target === null || target === week) {
      setDisplayWeek(week);
      if (target === week) targetWeekRef.current = null;
    }
  }, [week]);

  useEffect(() => () => clearQueuedRequest(), []);

  const requestImmediately = (nextWeek: number) => {
    const normalizedWeek = ((nextWeek % frameCount) + frameCount) % frameCount;
    clearQueuedRequest();
    targetWeekRef.current = normalizedWeek;
    setDisplayWeek(normalizedWeek);
    onWeek(normalizedWeek);
  };

  const queueSliderWeek = (nextWeek: number) => {
    clearQueuedRequest();
    setDisplayWeek(nextWeek);
    if (nextWeek === week) {
      targetWeekRef.current = null;
      return;
    }
    targetWeekRef.current = nextWeek;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      onWeekRef.current(nextWeek);
    }, TIMELINE_SCRUB_DELAY_MS);
  };

  const commitQueuedWeek = () => {
    const target = targetWeekRef.current;
    if (target === null) return;
    clearQueuedRequest();
    onWeekRef.current(target);
  };

  if (frameCount === 1) {
    return <section className="timeline-section timeline-reference"><div className="timeline-controls">
      <button aria-label="Previous week" disabled><ChevronLeft /></button>
      <button aria-label="Next week" disabled><ChevronRight /></button>
      <span>VERIFIED REFERENCE WEEK</span>
    </div><div className="reference-range" role="note">JAN 01–07 · SINGLE FRAME</div></section>;
  }

  return <section className="timeline-section"><div className="timeline-controls">
    <button onClick={() => requestImmediately(week - 1)} aria-label="Previous week" disabled={loading}><ChevronLeft /></button>
    <button onClick={() => requestImmediately(week + 1)} aria-label="Next week" disabled={loading}><ChevronRight /></button>
    <span>{loading ? 'LOADING SELECTED WEEK…' : 'DRAG TO SELECT WEEK'}</span>
  </div>
    <input className="week-range" type="range" min="0" max={frameCount - 1} value={displayWeek} onChange={(event) => queueSliderWeek(Number(event.target.value))}
      onPointerUp={commitQueuedWeek} onTouchEnd={commitQueuedWeek} onKeyUp={commitQueuedWeek}
      style={{ '--progress': `${displayWeek / (frameCount - 1) * 100}%` } as React.CSSProperties} aria-label="Week of year" aria-valuetext={`Week ${displayWeek + 1} of ${frameCount}`} />
    <div className="month-row" aria-hidden="true"><span>JAN</span><span>MAR</span><span>MAY</span><span>JUL</span><span>SEP</span><span>NOV</span><span>DEC</span></div>
  </section>;
}
