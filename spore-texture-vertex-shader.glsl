#version 300 es
precision mediump float;

uniform mat4 uMatrix;

in vec2 inPosition;
in vec2 inTexcoord;

out vec2 vTexcoord;

void main() {
  gl_PointSize = 1.0;
  gl_Position = vec4(inPosition, 0.0, 1.0);

  vTexcoord = inTexcoord;
}

