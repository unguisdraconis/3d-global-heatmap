precision highp float;
precision highp int;
uniform sampler2D uField;
uniform sampler2D uLut;
uniform float uHighlightActive;
uniform float uHighlightMin;
uniform float uHighlightMax;
uniform vec2 uGridSize;
uniform float uHeatmapGridActive;
uniform float uHeatmapGridOpacity;
uniform vec3 uHeatmapGridColor;
uniform float uGridLineHalfWidthPixels;
uniform float uGridFadeStartPixelsPerCell;
uniform float uGridFadeEndPixelsPerCell;
in vec2 vMapUv;
in vec3 vNormalW;
in float vProjectionMix;
out vec4 outColor;

float rawValue(vec2 encodedChannels) {
  vec2 encodedBytes = floor(encodedChannels * 255.0 + 0.5);
  return encodedBytes.r + encodedBytes.g * 256.0;
}
bool missing(float raw) { return raw >= 65533.5; }
float decode(float raw) { return raw * 0.01 - 100.0; }
float nativeGridCoverage(vec2 mapUv) {
  vec2 gridPosition = mapUv * uGridSize;
  vec2 positionInCell = fract(gridPosition);
  vec2 distanceToEdgeCells = min(positionInCell, 1.0 - positionInCell);
  vec2 cellsPerPixel = max(fwidth(gridPosition), vec2(0.0001));

  // Fade the complete grid when either cell dimension is too small to resolve.
  // This prevents polar/limb noise without changing the underlying texture.
  float pixelsPerCell = 1.0 / max(cellsPerPixel.x, cellsPerPixel.y);
  float visibility = smoothstep(
    uGridFadeStartPixelsPerCell,
    uGridFadeEndPixelsPerCell,
    pixelsPerCell
  );

  vec2 distanceToEdgePixels = distanceToEdgeCells / cellsPerPixel;
  float nearestEdgePixels = min(distanceToEdgePixels.x, distanceToEdgePixels.y);
  float line = 1.0 - smoothstep(
    max(0.0, uGridLineHalfWidthPixels - 0.5),
    uGridLineHalfWidthPixels + 0.5,
    nearestEdgePixels
  );
  return line * visibility * uHeatmapGridActive * uHeatmapGridOpacity;
}

void main() {
  vec2 mapUv = vMapUv;
  float rawTemperature = rawValue(texture(uField, mapUv).rg);
  float temperature = missing(rawTemperature) ? -999.0 : decode(rawTemperature);
  if (temperature < -900.0) {
    outColor = vec4(0.018, 0.045, 0.064, 1.0);
    return;
  }
  vec3 base = texture(uLut, vec2(clamp((temperature + 80.0) / 140.0, 0.0, 1.0), 0.5)).rgb;
  float fresnel = pow(1.0 - abs(vNormalW.z), 2.2) * (1.0 - vProjectionMix);
  base += vec3(0.02, 0.08, 0.1) * fresnel;
  base = mix(base, uHeatmapGridColor, nativeGridCoverage(mapUv));
  if (uHighlightActive > 0.5) {
    float match = step(uHighlightMin, temperature) * step(temperature, uHighlightMax);
    base = mix(base * 0.13, min(vec3(1.0), base * 1.35 + 0.08), match);
  }
  outColor = vec4(base, 1.0);
}
