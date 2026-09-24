import * as THREE from 'three';
import { GRID } from '../climate/constants';
import type { TemperatureRenderStyle } from '../climate/types';

/**
 * Grid presentation values are expressed in projected screen pixels. The
 * shader uses UV derivatives to fade lines without changing raster sampling.
 */
export const HEATMAP_GRID_PRESENTATION = Object.freeze({
  opacity: 0.24,
  lineHalfWidthPixels: 0.52,
  fadeStartPixelsPerCell: 1.35,
  fadeEndPixelsPerCell: 3.75,
  color: '#071317',
});

export function canonicalGridUniformSize(): THREE.Vector2 {
  return new THREE.Vector2(GRID.width, GRID.height);
}

export function heatmapGridActive(style: TemperatureRenderStyle): number {
  return style === 'heatmap' ? 1 : 0;
}

export function replaceTemperatureFieldTexture(
  uniforms: THREE.ShaderMaterial['uniforms'],
  fieldTexture: THREE.DataTexture,
): void {
  const fieldUniform = uniforms.uField;
  if (!fieldUniform) throw new Error('Temperature shader is missing its field uniform');
  fieldUniform.value = fieldTexture;
}

