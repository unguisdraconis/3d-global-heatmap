import { GRID } from '../climate/constants';
import { interpolateTemperatureC } from '../climate/temperature';
import type { DisplayMode, FramePair, SurfaceType } from '../climate/types';

export interface TemperatureLookup { surface: SurfaceType; temperatureC: number | null }

export function lookupTemperatureAtIndex(
  frames: Pick<FramePair, 'current' | 'next'>,
  mask: Uint8Array,
  mode: DisplayMode,
  index: number,
  interpolation: number,
): TemperatureLookup {
  if (!Number.isInteger(index) || index < 0 || index >= GRID.cellCount) throw new RangeError('temperature lookup index is outside the canonical grid');
  if (mask.length !== GRID.cellCount) throw new RangeError('mask does not match the canonical grid');
  if ([frames.current.air, frames.current.sst, frames.next.air, frames.next.sst].some((field) => field.length !== GRID.cellCount)) throw new RangeError('temperature field does not match the canonical grid');
  const surface: SurfaceType = mask[index] === 1 ? 'land' : 'ocean';
  if ((mode === 'air' && surface === 'ocean') || (mode === 'sst' && surface === 'land')) return { surface, temperatureC: null };
  const useAir = mode === 'air' || (mode === 'composite' && surface === 'land');
  const current = useAir ? frames.current.air : frames.current.sst;
  const next = useAir ? frames.next.air : frames.next.sst;
  return { surface, temperatureC: interpolateTemperatureC(current[index]!, next[index]!, interpolation) };
}
