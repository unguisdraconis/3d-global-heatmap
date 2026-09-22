import type { TemperatureUnit } from '../climate/types';
export function UnitControl({ unit, onChange }: { unit: TemperatureUnit; onChange: (unit: TemperatureUnit) => void }) {
  return <button className="unit-button" onClick={() => onChange(unit === 'C' ? 'F' : 'C')} aria-label={`Switch to degrees ${unit === 'C' ? 'Fahrenheit' : 'Celsius'}`}>°{unit}</button>;
}

