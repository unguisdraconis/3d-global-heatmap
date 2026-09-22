precision highp float;
uniform sampler2D uAirA;
uniform sampler2D uAirB;
uniform sampler2D uSstA;
uniform sampler2D uSstB;
uniform sampler2D uMask;
uniform sampler2D uLut;
uniform float uMix;
uniform float uMode;
uniform float uHighlightActive;
uniform float uHighlightMin;
uniform float uHighlightMax;
varying vec2 vUv;
varying vec3 vNormalW;

float rawValue(sampler2D field) { return texture2D(field, vUv).r * 65535.0; }
bool missing(float raw) { return raw >= 65533.5; }
float decode(float raw) { return raw * 0.01 - 100.0; }
float interpolateValid(float first, float second) {
  if (missing(first) && missing(second)) return -999.0;
  if (missing(first)) return decode(second);
  if (missing(second)) return decode(first);
  return mix(decode(first), decode(second), uMix);
}

void main() {
  float land = step(0.5, texture2D(uMask, vUv).r);
  float air = interpolateValid(rawValue(uAirA), rawValue(uAirB));
  float sst = interpolateValid(rawValue(uSstA), rawValue(uSstB));
  float temperature = uMode < 0.5 ? mix(sst, air, land) : (uMode < 1.5 ? air : sst);
  bool unsupported = (uMode > 0.5 && uMode < 1.5 && land < 0.5) || (uMode > 1.5 && land > 0.5);
  if (unsupported || temperature < -900.0) {
    gl_FragColor = vec4(0.018, 0.045, 0.064, 1.0);
    return;
  }
  vec3 base = texture2D(uLut, vec2(clamp((temperature + 80.0) / 140.0, 0.0, 1.0), 0.5)).rgb;
  float fresnel = pow(1.0 - abs(vNormalW.z), 2.2);
  base += vec3(0.02, 0.08, 0.1) * fresnel;
  if (uHighlightActive > 0.5) {
    float match = step(uHighlightMin, temperature) * step(temperature, uHighlightMax);
    base = mix(base * 0.13, min(vec3(1.0), base * 1.35 + 0.08), match);
  }
  gl_FragColor = vec4(base, 1.0);
}
