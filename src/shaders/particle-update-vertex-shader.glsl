#version 300 es
precision highp float;
precision highp int;

uniform float timeDelta; // in seconds
uniform sampler2D uSpores;
uniform int frameCount;

in vec2 inPosition;
in vec2 inVelocity;
in vec4 inColor;

out vec4 outColor;
out vec4 vColor;
out vec2 outPosition;
out vec2 outVelocity;

float velocityMultiplier = 1.0;
float sporeSize = 5.0;
float minRange = 0.0;
float range = 0.020;
float turnRate = 0.2;
int samples = 5;
float color_adoption_rate = 0.9;

bool onField(float n) {
   return abs(n) <= 1.0;
}

vec2 rotate(vec2 v, float a) {
	float s = sin(a);
	float c = cos(a);
	mat2 m = mat2(c, -s, s, c);
	return m * v;
}

vec4 sanitize(vec4 v) {
   return vec4(
      min(v.r, 1.0),
      min(v.g, 1.0),
      min(v.b, 1.0),
      min(v.a, 1.0)
   );
}

float calcLuminance(vec4 color) {
   return (0.2126 * color.r) + (0.7152 * color.g) + (0.0722 * color.b);
}

void main() {
   float rangePerSample = (range - minRange) / float(samples);

   vec2 v = inVelocity;
   // float speed = length(v) / timeDelta;

   // vec2 leftVelocity = rotate(v, radians(90.0));
   // vec2 rightVelocity = rotate(v, radians(-90.0));

   vec2 texPosition = (inPosition + 1.0) / 2.0;

   vec2 leftVelocity = vec2(-v.y, v.x);
   vec2 rightVelocity = vec2(v.y, -v.x);

   float leftSpores = 0.0;
   float rightSpores = 0.0;
   float fSamples = float(samples);

   vec4 color = vec4(0.0);

   for (float i = minRange; i <= fSamples; i++) {
      vec4 left = texture(uSpores, texPosition + (leftVelocity * i * rangePerSample));
      leftSpores += left.r + left.g + left.b;
      color += left;
   }

   for (float i = minRange; i <= fSamples; i++) {
      vec4 right = texture(uSpores, texPosition + (rightVelocity * i * rangePerSample));
      rightSpores += right.r + right.g + right.b;
      color += right;
   }

   vec2 remainingVelocity = inVelocity * (1.0 - turnRate);
   vec2 leftComponent = remainingVelocity + (turnRate * leftSpores * leftVelocity / fSamples);
   vec2 rightComponent = remainingVelocity + (turnRate * rightSpores * rightVelocity / fSamples);

   outVelocity = leftComponent + rightComponent;
   // outVelocity = inVelocity;

   outVelocity = velocityMultiplier * normalize(outVelocity);

   vec2 nextPosition = inPosition + (outVelocity * timeDelta);
   if (abs(nextPosition.x) > 1.0) outVelocity.x *= -1.0;
   if (abs(nextPosition.y) > 1.0) outVelocity.y *= -1.0;

   outPosition = inPosition + (outVelocity * timeDelta);
   // outColor = sanitize(vec4(1.0, normalize(outVelocity).x, normalize(outVelocity).y, 1.0));
   // outColor = vec4(
   //    1.0,
   //    leftSpores / fSamples,
   //    rightSpores / fSamples,
   //    1.0
   // );
   // vec4 peerColor = normalize(vec4(color.rgb, 1.0));
   // float peerPressure = 0.1 * length(vec4(peerColor.rgb, 0.0));
   // outColor = (inColor * (1.0 - peerPressure)) + (normalize(peerColor) * peerPressure);

   float keep_new_factor = color_adoption_rate;
   float keep_old_factor = 1.0 - color_adoption_rate;

   vColor = vec4(
      (inColor.r * keep_old_factor) + (color.r * keep_new_factor),
      (inColor.g * keep_old_factor) + (color.g * keep_new_factor),
      (inColor.b * keep_old_factor) + (color.b * keep_new_factor),
      1.0
   );

   float oldLuminance = calcLuminance(inColor);
   float newLuminance = calcLuminance(vColor);

   vColor *= oldLuminance / newLuminance;

   outColor = inColor;
   // outColor = vec4(color.rgb, 1.0);
   // outColor = inColor;

   // gl_PointSize = max(1.0, sporeSize * ((leftSpores + rightSpores) / float(2 * samples)));
   gl_PointSize = sporeSize;
   gl_Position = vec4(outPosition, 0, 1.0);
   // outPosition = inPosition + inVelocity * timeDelta;
   // outVelocity = outVelocity;
}

