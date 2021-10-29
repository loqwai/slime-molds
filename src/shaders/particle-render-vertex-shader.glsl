#version 300 es
precision highp float;

in vec2 inPosition;

out vec4 vPosition;

void main() {
  vPosition = vec4(inPosition, 0.0, 1.0);
  gl_PointSize = 4.0;
  gl_Position = vPosition;
}

