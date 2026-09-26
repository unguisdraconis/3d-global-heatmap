uniform float uProjectionMix;
in vec3 mapPosition;

void main() {
  float projectionEase = smoothstep(0.0, 1.0, uProjectionMix);
  vec3 projectedPosition = mix(position, mapPosition, projectionEase);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(projectedPosition, 1.0);
}
