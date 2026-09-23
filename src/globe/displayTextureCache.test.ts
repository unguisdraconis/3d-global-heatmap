import { describe, expect, it, vi } from 'vitest';
import { GRID } from '../climate/constants';
import type { DecodedFrame } from '../climate/types';
import { DisplayTextureCache } from './displayTextureCache';

function frame(id: string, value: number): DecodedFrame {
  const air = new Uint16Array(GRID.cellCount); air.fill(value);
  const sst = new Uint16Array(GRID.cellCount); sst.fill(value + 1);
  return { id, air, sst };
}

describe('DisplayTextureCache', () => {
  it('reuses a frame texture when the prior next frame becomes current', () => {
    const cache = new DisplayTextureCache(3); const mask = new Uint8Array(GRID.cellCount);
    const current = frame('current', 10_000); const next = frame('next', 11_000);
    const currentTexture = cache.get(current, mask, 'composite');
    const nextTexture = cache.get(next, mask, 'composite');
    expect(cache.get(current, mask, 'composite')).toBe(currentTexture);
    expect(cache.get(next, mask, 'composite')).toBe(nextTexture);
    expect(cache.size).toBe(2);
    cache.dispose();
  });

  it('keeps modes distinct and disposes the least-recently-used texture', () => {
    const cache = new DisplayTextureCache(2); const mask = new Uint8Array(GRID.cellCount); mask[0] = 1;
    const first = frame('first', 10_000); const second = frame('second', 11_000);
    const composite = cache.get(first, mask, 'composite');
    const air = cache.get(first, mask, 'air');
    const dispose = vi.spyOn(composite, 'dispose');
    expect(air).not.toBe(composite);
    cache.get(second, mask, 'composite');
    expect(dispose).toHaveBeenCalledOnce();
    expect(cache.size).toBe(2);
    cache.dispose();
  });
});
