out vec3 vSpherePosition;
out vec3 vNormalW;

void main() {
  vSpherePosition = position;
  vNormalW = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
