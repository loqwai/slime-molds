#version 300 es
precision mediump float;

in vec2 inPosition;

void main() {
  gl_PointSize = 4.0;
  gl_Position = vec4(inPosition, 0, 1.0);
}

