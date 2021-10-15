#version 300 es
precision mediump float;

uniform int frameCount;
uniform int sporeInterval;

in vec2 vTexcoord;

out vec4 outColor;

void main() {
  if (frameCount % sporeInterval == 0) {
    outColor = vec4(1.0, 0.82, 0.4, 1.0);
  } else {
    outColor = vec4(0.0);
  }
 }
