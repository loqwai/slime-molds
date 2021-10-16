#version 300 es
precision mediump float;

uniform int frameCount;
uniform int sporeInterval;

in vec2 vTexcoord;

out vec4 outColor;

int attractSwitchInterval = 300; // Every N frames, we'll switch between attract and repel

void main() {
  if (frameCount % sporeInterval == 0) {
    bool attract = (frameCount / attractSwitchInterval) % 2 == 0;

    outColor = attract ? vec4(1.0, 0.82, 0.4, 1.0) : vec4(1.0, 0.60, 0.2, 1.0);
  } else {
    outColor = vec4(0.0);
  }
 }
