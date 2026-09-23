import type * as THREE from 'three';
import type { DecodedFrame, DisplayMode } from '../climate/types';
import { createPackedDisplayField } from './displayField';
import { createPackedClimateTexture } from './textures';

export const DISPLAY_TEXTURE_CACHE_SIZE = 8;

interface CacheEntry {
  frame: DecodedFrame;
  mask: Uint8Array;
  mode: DisplayMode;
  texture: THREE.DataTexture;
}

export class DisplayTextureCache {
  readonly #entries: CacheEntry[] = [];

  constructor(readonly capacity = DISPLAY_TEXTURE_CACHE_SIZE) {
    if (!Number.isInteger(capacity) || capacity < 2) throw new RangeError('display texture cache capacity must be at least two');
  }

  get size(): number { return this.#entries.length; }

  get(frame: DecodedFrame, mask: Uint8Array, mode: DisplayMode): THREE.DataTexture {
    const existingIndex = this.#entries.findIndex((entry) => entry.frame === frame && entry.mask === mask && entry.mode === mode);
    if (existingIndex >= 0) {
      const [existing] = this.#entries.splice(existingIndex, 1);
      this.#entries.push(existing!);
      return existing!.texture;
    }

    const texture = createPackedClimateTexture(createPackedDisplayField(frame, mask, mode));
    this.#entries.push({ frame, mask, mode, texture });
    if (this.#entries.length > this.capacity) this.#entries.shift()!.texture.dispose();
    return texture;
  }

  dispose(): void {
    for (const entry of this.#entries) entry.texture.dispose();
    this.#entries.length = 0;
  }
}
