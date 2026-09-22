import { Eye, Globe2, Waves } from 'lucide-react';
import type { DisplayMode } from '../climate/types';

export function DisplayModeControl({ value, onChange }: { value: DisplayMode; onChange: (mode: DisplayMode) => void }) {
  return <section className="control-section"><span className="eyebrow">DISPLAY LAYER</span><div className="segmented mode-switch" role="group" aria-label="Temperature layer">
    <button aria-pressed={value === 'composite'} className={value === 'composite' ? 'active' : ''} onClick={() => onChange('composite')}><Globe2 size={15} /> Composite</button>
    <button aria-pressed={value === 'air'} className={value === 'air' ? 'active' : ''} onClick={() => onChange('air')}><Eye size={15} /> Air · land</button>
    <button aria-pressed={value === 'sst'} className={value === 'sst' ? 'active' : ''} onClick={() => onChange('sst')}><Waves size={15} /> Sea</button>
  </div></section>;
}

