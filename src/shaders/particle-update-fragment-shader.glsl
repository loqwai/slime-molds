#version 300 es
precision mediump float;

uniform int frameCount;
uniform int sporeInterval;

in vec2 vTexcoord;

in vec4 vColor;
out vec4 color;

void main() {
  color = vColor;
}


