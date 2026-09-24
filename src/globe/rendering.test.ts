import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GRID } from '../climate/constants';
import { canonicalGridUniformSize, HEATMAP_GRID_PRESENTATION, heatmapGridActive, replaceTemperatureFieldTexture } from './rendering';

describe('native heatmap rendering configuration', () => {
  it('supplies the canonical 0.25° grid dimensions to the shader', () => {
    const size = canonicalGridUniformSize();
    expect(size.toArray()).toEqual([GRID.width, GRID.height]);
    expect(GRID.resolution).toBe(0.25);
  });
  it('maps render styles to a uniform without changing raster configuration', () => {
    expect(heatmapGridActive('heatmap')).toBe(1); expect(heatmapGridActive('smooth')).toBe(0);
    expect(HEATMAP_GRID_PRESENTATION.fadeStartPixelsPerCell).toBeLessThan(HEATMAP_GRID_PRESENTATION.fadeEndPixelsPerCell);
  });
  it('replaces a weekly field without resetting a locked temperature highlight', () => {
    const current = new THREE.DataTexture();
    const next = new THREE.DataTexture();
    const uniforms = {
      uField: { value: current },
      uHighlightActive: { value: 1 },
      uHighlightMin: { value: 19.5 },
      uHighlightMax: { value: 20.5 },
    };

    replaceTemperatureFieldTexture(uniforms, next);

    expect(uniforms.uField.value).toBe(next);
    expect(uniforms.uHighlightActive.value).toBe(1);
    expect(uniforms.uHighlightMin.value).toBe(19.5);
    expect(uniforms.uHighlightMax.value).toBe(20.5);
  });
});

