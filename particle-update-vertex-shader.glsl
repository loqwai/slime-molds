#version 300 es
precision mediump float;

/* Number of seconds (possibly fractional) that has passed since the last
   update step. */
uniform float timeDelta;

/* Inputs. These reflect the state of a single particle before the update. */

/* Where the particle is. */
in vec2 inPosition;

/* Which direction it is moving, and how fast. */
in vec2 inVelocity;

/* Outputs. These mirror the inputs. These values will be captured
   into our transform feedback buffer! */
out vec2 outPosition;
out vec2 outVelocity;

void main() {
   outPosition = inPosition + (inVelocity * timeDelta);
   outVelocity = inVelocity;

   gl_PointSize = 1.0;
   gl_Position = vec4(outPosition, 0, 1.0);
   // outPosition = inPosition + inVelocity * timeDelta;
   // outVelocity = outVelocity;
}

