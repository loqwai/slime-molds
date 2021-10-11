#version 300 es
precision mediump float;

out vec4 outColor;

uniform int frameCount;
uniform int sporeInterval;

void main() {
  if (frameCount % sporeInterval == 0) {
    outColor = vec4(1.0);
  } else {
    outColor = vec4(0);
  }
 }
