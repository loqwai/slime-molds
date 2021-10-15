#version 300 es
precision mediump float;
precision mediump int;

uniform float timeDelta; // in seconds
uniform sampler2D uSpores;
uniform int sporeInterval;

in vec2 inPosition;
in vec2 inVelocity;

out vec2 outPosition;
out vec2 outVelocity;

float range = 1.0;
int samples = 10;
float turnRate = 0.03;

void main() {
   float rangePerSample = range / float(samples);
   vec2 v = inVelocity;
   float speed = length(v) / timeDelta;

   vec2 leftVelocity  = vec2( v.y, -v.x);
   vec2 rightVelocity = vec2(-v.y,  v.x);

   float leftSpores = 0.0;
   float rightSpores = 0.0;

   for (int i = 1; i <= samples; i++) {
      vec4 left = texture(uSpores, inPosition + (normalize(leftVelocity) * (float(i) * rangePerSample)));
      leftSpores += left.r;
   }

   for (int i = 1; i <= samples; i++) {
      vec4 right = texture(uSpores, inPosition + (normalize(rightVelocity) * (float(i) * rangePerSample)));
      rightSpores += right.r;
   }

   if (leftSpores < rightSpores) {
      outVelocity = ((1.0 - turnRate) * inVelocity) + (turnRate * rightVelocity);
   } else {
      outVelocity = ((1.0 - turnRate) * inVelocity) + (turnRate * leftVelocity);
   }

   outVelocity = 0.3 * normalize(outVelocity);

   vec2 nextPosition = inPosition + (outVelocity * timeDelta);
   if (nextPosition.x < -1.0 || nextPosition.x > 1.0) outVelocity.x *= -1.0;
   if (nextPosition.y < -1.0 || nextPosition.y > 1.0) outVelocity.y *= -1.0;

   outPosition = inPosition + (outVelocity * timeDelta);

   gl_PointSize = 4.0; // spore size
   gl_Position = vec4(outPosition, 0, 1.0);
   // outPosition = inPosition + inVelocity * timeDelta;
   // outVelocity = outVelocity;
}

