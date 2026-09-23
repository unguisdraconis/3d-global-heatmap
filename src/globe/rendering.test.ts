import { describe, expect, it } from 'vitest';
import { GRID } from '../climate/constants';
import { canonicalGridUniformSize, HEATMAP_GRID_PRESENTATION, heatmapGridActive } from './rendering';

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
});

