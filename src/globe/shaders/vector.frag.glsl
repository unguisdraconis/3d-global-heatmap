precision highp float;
uniform vec3 uColor;
uniform float uOpacity;
out vec4 outColor;

void main() {
  outColor = vec4(uColor, uOpacity);
}
