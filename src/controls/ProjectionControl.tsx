import { Globe2, Map as MapIcon } from 'lucide-react';
import type { ProjectionMode } from '../climate/types';

interface Props { value: ProjectionMode; onChange: (mode: ProjectionMode) => void }

export function ProjectionControl({ value, onChange }: Props) {
  return <section className="control-section projection-control"><span className="eyebrow">VIEW</span>
    <div className="segmented projection-switch" role="group" aria-label="Earth view">
      <button aria-pressed={value === 'globe'} className={value === 'globe' ? 'active' : ''} onClick={() => onChange('globe')}><Globe2 size={15} /> Globe</button>
      <button aria-label="Plate Carrée map" aria-pressed={value === 'map'} className={value === 'map' ? 'active' : ''} onClick={() => onChange('map')}><MapIcon size={15} /> Map</button>
    </div>
  </section>;
}
