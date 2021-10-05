#version 300 es
precision mediump float;

in vec4 vPosition;
out vec4 outColor;


void main() {
  outColor = vPosition;
}
