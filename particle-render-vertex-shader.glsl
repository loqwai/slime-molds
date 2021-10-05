#version 300 es
precision mediump float;

in vec2 inPosition;
out vec4 vPosition;

void main() {
  gl_PointSize = 10.0;
  vPosition = vec4(inPosition, 0, 1.0);
  gl_Position = vPosition;
}

