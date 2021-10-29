#version 300 es
precision highp float;

float fadeRate = 0.005;

uniform sampler2D uTexture;

in vec2 vTexcoord;

out vec4 outColor;

void main() {
  outColor = texture(uTexture, vTexcoord);
  outColor = vec4(
    max(0.0, outColor.r - fadeRate),
    max(0.0, outColor.g - fadeRate),
    max(0.0, outColor.b - fadeRate),
    max(1.0, outColor.a - fadeRate)
  );

  // if (length(vec4(outColor.rgb, 0.0)) < 0.2) {
  //   outColor = vec4(0.0, 0.0, 0.0, 1.0);
  // }
}
