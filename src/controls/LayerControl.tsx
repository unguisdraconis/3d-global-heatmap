import { Eye, EyeOff, Layers3 } from 'lucide-react';
import { useState } from 'react';
import type { VectorLayerVisibility } from '../climate/types';

export function LayerControl({ layers, onToggle }: { layers: VectorLayerVisibility; onToggle: (layer: keyof VectorLayerVisibility) => void }) {
  const [open, setOpen] = useState(false);
  return <div className="layers-wrap"><button className={`icon-button ${open ? 'selected' : ''}`} aria-label="Map layers" aria-expanded={open} onClick={() => setOpen((value) => !value)}><Layers3 size={18} /></button>
    {open && <div className="layers-popover"><span className="eyebrow">MAP OVERLAYS</span>{(Object.keys(layers) as (keyof VectorLayerVisibility)[]).map((key) =>
      <button key={key} aria-pressed={layers[key]} onClick={() => onToggle(key)}>{layers[key] ? <Eye size={15} /> : <EyeOff size={15} />} {key[0]!.toUpperCase() + key.slice(1)}</button>)}</div>}
  </div>;
}
