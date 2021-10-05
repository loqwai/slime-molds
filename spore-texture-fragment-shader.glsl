#version 300 es
precision mediump float;

uniform sampler2D uTexture;

in vec2 vTexcoord;

out vec4 outColor;

void main() {
  outColor = texture(uTexture, vTexcoord);
}
