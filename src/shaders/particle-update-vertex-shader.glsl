#version 300 es
precision mediump float;

uniform float timeDelta; // in seconds
uniform sampler2D uSpores;

in vec2 inPosition;
in vec2 inVelocity;

out vec2 outPosition;
out vec2 outVelocity;

void main() {
   vec2 v = inVelocity;
   vec2 leftVelocity  = vec2( v.y, -v.x);
   vec2 rightVelocity = vec2(-v.y,  v.x);

   vec4 left = texture(uSpores, inPosition + (leftVelocity * timeDelta));
   vec4 right = texture(uSpores, inPosition + (rightVelocity * timeDelta));

   if (left == vec4(1)) {
      outVelocity = leftVelocity;
   } else if (right == vec4(1)) {
      outVelocity = rightVelocity;
   } else {
      outVelocity = inVelocity;
   }

   outPosition = inPosition + (outVelocity * timeDelta);

   gl_PointSize = 1.0;
   gl_Position = vec4(outPosition, 0, 1.0);
   // outPosition = inPosition + inVelocity * timeDelta;
   // outVelocity = outVelocity;
}

