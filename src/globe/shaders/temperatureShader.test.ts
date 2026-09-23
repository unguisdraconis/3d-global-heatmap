import { describe, expect, it } from 'vitest';
import fragmentShader from './temperature.frag.glsl?raw';
import vertexShader from './temperature.vert.glsl?raw';

describe('temperature shader GPU data contract', () => {
  it('uses GLSL 3 RG8 byte decoding and exact Uint16 sentinels', () => {
    expect(vertexShader).toContain('out vec3 vSpherePosition');
    expect(vertexShader).toContain('vSpherePosition = position');
    expect(fragmentShader).toContain('uniform sampler2D uField');
    expect(fragmentShader).toContain('float rawValue(vec2 encodedChannels)');
    expect(fragmentShader).toContain('vec2 encodedBytes');
    expect(fragmentShader).toContain('encodedBytes.r + encodedBytes.g * 256.0');
    expect(fragmentShader).toContain('vec2 sphericalUv()');
    expect(fragmentShader).toContain('atan(-direction.z, direction.x)');
    expect(fragmentShader).toContain('rawValue(texture(uField, mapUv).rg)');
    expect(fragmentShader).not.toContain('uAirA');
    expect(fragmentShader).not.toContain('uSstA');
    expect(fragmentShader).not.toContain('rawValue(sampler2D');
    expect(fragmentShader).toContain('raw >= 65533.5');
    expect(fragmentShader).not.toContain('texture2D');
  });
});
