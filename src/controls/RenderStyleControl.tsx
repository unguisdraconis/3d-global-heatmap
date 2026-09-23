import { Circle, Grid2X2 } from 'lucide-react';
import type { TemperatureRenderStyle } from '../climate/types';

export function RenderStyleControl({ value, onChange }: { value: TemperatureRenderStyle; onChange: (style: TemperatureRenderStyle) => void }) {
  return <section className="control-section render-style-control"><span className="eyebrow">RASTER STYLE</span>
    <div className="segmented render-style-switch" role="group" aria-label="Temperature rendering style">
      <button aria-pressed={value === 'heatmap'} className={value === 'heatmap' ? 'active' : ''} onClick={() => onChange('heatmap')}><Grid2X2 size={15} /> Native grid</button>
      <button aria-pressed={value === 'smooth'} className={value === 'smooth' ? 'active' : ''} onClick={() => onChange('smooth')}><Circle size={15} /> Clean</button>
    </div>
  </section>;
}

