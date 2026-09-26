import { describe, expect, it } from 'vitest';
import fragmentShader from './temperature.frag.glsl?raw';
import vertexShader from './temperature.vert.glsl?raw';

describe('temperature shader GPU data contract', () => {
  it('uses GLSL 3 RG8 byte decoding and exact Uint16 sentinels', () => {
    expect(vertexShader).toContain('uniform float uProjectionMix');
    expect(vertexShader).toContain('vec3 mapPosition');
    expect(vertexShader).toContain('mix(position, mapPosition, projectionEase)');
    expect(vertexShader).toContain('vMapUv = uv');
    expect(fragmentShader).toContain('uniform sampler2D uField');
    expect(fragmentShader).toContain('float rawValue(vec2 encodedChannels)');
    expect(fragmentShader).toContain('vec2 encodedBytes');
    expect(fragmentShader).toContain('encodedBytes.r + encodedBytes.g * 256.0');
    expect(fragmentShader).toContain('vec2 mapUv = vMapUv');
    expect(fragmentShader).toContain('(1.0 - vProjectionMix)');
    expect(fragmentShader).toContain('rawValue(texture(uField, mapUv).rg)');
    expect(fragmentShader).not.toContain('uAirA');
    expect(fragmentShader).not.toContain('uSstA');
    expect(fragmentShader).not.toContain('rawValue(sampler2D');
    expect(fragmentShader).toContain('raw >= 65533.5');
    expect(fragmentShader).not.toContain('texture2D');
  });
});
