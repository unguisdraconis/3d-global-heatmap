import { describe, expect, it } from 'vitest';
import fragmentShader from './vector.frag.glsl?raw';
import vertexShader from './vector.vert.glsl?raw';

describe('vector shader projection contract', () => {
  it('morphs matching globe and Plate Carrée positions with the shared projection mix', () => {
    expect(vertexShader).toContain('in vec3 mapPosition');
    expect(vertexShader).toContain('uniform float uProjectionMix');
    expect(vertexShader).toContain('mix(position, mapPosition, projectionEase)');
    expect(fragmentShader).toContain('uniform vec3 uColor');
    expect(fragmentShader).toContain('uniform float uOpacity');
  });
});
