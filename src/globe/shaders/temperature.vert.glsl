uniform float uProjectionMix;

out vec2 vMapUv;
out vec3 vNormalW;
out float vProjectionMix;

void main() {
  float projectionEase = smoothstep(0.0, 1.0, uProjectionMix);
  vec3 mapPosition = vec3(uv.x * 2.0 - 1.0, uv.y - 0.5, 0.0);
  vec3 projectedPosition = mix(position, mapPosition, projectionEase);
  vec3 projectedNormal = normalize(mix(normal, vec3(0.0, 0.0, 1.0), projectionEase));

  vMapUv = uv;
  vNormalW = normalize(normalMatrix * projectedNormal);
  vProjectionMix = projectionEase;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(projectedPosition, 1.0);
}
