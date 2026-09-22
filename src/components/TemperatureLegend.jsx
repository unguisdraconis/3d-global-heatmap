import { useEffect, useMemo, useRef, useState } from 'react';
import { area, curveBasis } from 'd3-shape';
import { scaleLinear } from 'd3-scale';
import { format } from 'd3-format';
import { pointer, select } from 'd3-selection';
import { temperatureColor } from '../lib/colorScale';

const MIN = -80;
const MAX = 60;
const WIDTH = 760;
const HEIGHT = 108;
const PAD = 10;

export default function TemperatureLegend({ histogram, units, hoverValue, range, onRangeChange }) {
  const svgRef = useRef(null);
  const [locked, setLocked] = useState(false);
  const x = useMemo(() => scaleLinear().domain([MIN, MAX]).range([PAD, WIDTH - PAD]), []);
  const bins = histogram?.combined || [];
  const maxBin = Math.max(1, ...bins);
  const histogramPath = useMemo(() => area()
    .x((_, i) => x(MIN + (i + 0.5) * 0.5))
    .y0(68)
    .y1((d) => 68 - (d / maxBin) * 28)
    .curve(curveBasis)(bins), [bins, maxBin, x]);

  useEffect(() => {
    const svg = select(svgRef.current);
    const move = (event) => {
      if (locked) return;
      const [px] = pointer(event, svgRef.current);
      const value = Math.max(MIN, Math.min(MAX, x.invert(px)));
      onRangeChange({ value, min: value - 0.5, max: value + 0.5, locked: false });
    };
    const leave = () => { if (!locked) onRangeChange(null); };
    const click = (event) => {
      if (locked) {
        setLocked(false);
        onRangeChange(null);
      } else {
        const [px] = pointer(event, svgRef.current);
        const value = Math.max(MIN, Math.min(MAX, x.invert(px)));
        setLocked(true);
        onRangeChange({ value, min: value - 0.5, max: value + 0.5, locked: true });
      }
    };
    svg.on('pointermove', move).on('pointerleave', leave).on('click', click);
    return () => svg.on('pointermove', null).on('pointerleave', null).on('click', null);
  }, [locked, onRangeChange, x]);

  const ticks = [-80, -60, -40, -20, 0, 20, 40, 60];
  const marker = range?.value ?? hoverValue;
  const toDisplay = (value) => units === 'F' ? value * 9 / 5 + 32 : value;
  const percent = range && histogram?.areaTotal
    ? (((bins[Math.max(0, Math.min(bins.length - 1, Math.floor((range.value - MIN) / 0.5)))] || 0) / histogram.areaTotal) * 100)
    : null;

  return (
    <section className="legend-card" aria-label="Interactive temperature legend">
      <div className="legend-heading">
        <div>
          <span className="eyebrow">TEMPERATURE DISTRIBUTION</span>
          <p>Hover a temperature to isolate it globally</p>
        </div>
        <div className={`legend-readout ${range ? 'active' : ''}`}>
          {range ? <><strong>{format('.1f')(toDisplay(range.value))}°</strong><span>±{units === 'F' ? '0.9' : '0.5'}° {locked ? 'LOCKED' : 'HOVER'}</span></> : <><strong>—</strong><span>SELECT RANGE</span></>}
        </div>
      </div>
      <svg ref={svgRef} className="legend-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="slider" aria-valuemin={MIN} aria-valuemax={MAX}>
        <defs>
          <linearGradient id="temp-gradient">
            {Array.from({ length: 15 }, (_, i) => <stop key={i} offset={`${(i / 14) * 100}%`} stopColor={temperatureColor(MIN + (i / 14) * (MAX - MIN))} />)}
          </linearGradient>
          <linearGradient id="hist-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#d8f5ed" stopOpacity=".4" />
            <stop offset="1" stopColor="#d8f5ed" stopOpacity=".02" />
          </linearGradient>
        </defs>
        {histogramPath && <path d={histogramPath} fill="url(#hist-gradient)" stroke="#d8f5ed" strokeOpacity=".32" strokeWidth="1" />}
        <rect x={PAD} y="72" width={WIDTH - PAD * 2} height="14" rx="7" fill="url(#temp-gradient)" />
        {ticks.map((tick) => <g key={tick} transform={`translate(${x(tick)}, 0)`}><line y1="89" y2="94" stroke="#7d929d" /><text y="105" textAnchor="middle">{Math.round(toDisplay(tick))}°</text></g>)}
        {range && <rect x={x(range.min)} y="70" width={Math.max(2, x(range.max) - x(range.min))} height="18" rx="4" fill="none" stroke="#fff" strokeWidth="1.5" />}
        {marker != null && <g transform={`translate(${x(marker)}, 0)`}><path d="M0 66 L-5 58 L5 58 Z" fill="#fff" /><line y1="15" y2="58" stroke="#fff" strokeOpacity=".55" strokeDasharray="2 3" /></g>}
      </svg>
      <div className="legend-foot">
        <span>{Math.round(toDisplay(MIN))}°{units}</span>
        <span>{percent == null ? 'AREA-WEIGHTED · FIXED ANNUAL SCALE' : `≈ ${percent.toFixed(1)}% OF DISPLAYED SURFACE`}</span>
        <span>{Math.round(toDisplay(MAX)) > 0 ? '+' : ''}{Math.round(toDisplay(MAX))}°{units}</span>
      </div>
    </section>
  );
}
