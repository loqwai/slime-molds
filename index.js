const fetchShader = async (filename)  => (await fetch(filename)).text()

const createShader = async (gl, type, filename) => {
  const shader = gl.createShader(type)
  const shaderSource = await fetchShader(filename)
  gl.shaderSource(shader, shaderSource)
  gl.compileShader(shader, shaderSource)

  var status = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!status) {
    throw new Error(`Could not compile shader "${filename}": ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}

const getParticleUpdateVertexShader = async (gl) => createShader(gl, gl.VERTEX_SHADER, 'particle-update-vertex-shader.glsl')
const getParticleUpdateFragmentShader = async (gl) => createShader(gl, gl.FRAGMENT_SHADER, 'particle-update-fragment-shader.glsl')
const getParticleRenderVertexShader = async (gl) => createShader(gl, gl.VERTEX_SHADER, 'particle-render-vertex-shader.glsl')
const getParticleRenderFragmentShader = async (gl) => createShader(gl, gl.FRAGMENT_SHADER, 'particle-render-fragment-shader.glsl')

const createUpdateProgram = async (gl) => {
  const program = gl.createProgram()

  gl.attachShader(program, await getParticleUpdateVertexShader(gl))
  gl.attachShader(program, await getParticleUpdateFragmentShader(gl))

  gl.transformFeedbackVaryings(
    program,
    ["outPosition", "outVelocity"],
    gl.SEPARATE_ATTRIBS,
  )

  gl.linkProgram(program);

  const status = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!status) {
    throw new Error(`Could not link update program. ${gl.getProgramInfoLog(program)}\n`);
  }
  return program;
}

const createRenderProgram = async (gl) => {
  const program = gl.createProgram()

  gl.attachShader(program, await getParticleRenderVertexShader(gl))
  gl.attachShader(program, await getParticleRenderFragmentShader(gl))

  gl.linkProgram(program);

  const status = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!status) {
    throw new Error(`Could not link render program. ${gl.getProgramInfoLog(program)}\n`);
  }
  return program;
}

function createParticleData(numParts, minAge, maxAge) {
  var data = [];
  for (var i = 0; i < numParts; ++i) {
    // position
    data.push(0.0);
    data.push(0.0);

    var life = minAge + Math.random() * (maxAge - minAge);
    // set age to max. life + 1 to ensure the particle gets initialized
    // on first invocation of particle update shader
    data.push(life + 1);
    data.push(life);

    // velocity
    data.push(0.0);
    data.push(0.0);
  }
  return data;
}

const render = (gl, state, timestamp) => {
  const timeDelta = timestamp - state.previousTimestamp

  state.previousTimestamp = timestamp

  // Update
  gl.uniform1f(gl.getUniformLocation(state.updateProgram, "timeDelta"), timeDelta / 1000.0);
  gl.bindVertexArray(state.vaos.updateRead)
  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, state.vaos.updateWrite);
  gl.enable(gl.RASTERIZER_DISCARD);
  /* Begin transform feedback! */
  gl.beginTransformFeedback(gl.POINTS);
  gl.drawArrays(gl.POINTS, 0, state.particlesCount);
  gl.endTransformFeedback();
  gl.disable(gl.RASTERIZER_DISCARD);
  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);

  // Render
  gl.bindVertexArray(state.vaos.renderRead);
  gl.useProgram(state.renderProgram);
  gl.drawArrays(gl.POINTS, 0, state.particlesCount);

   /* Swap read and write buffers. The updated state will be rendered on the next frame. */
  const updateTmp = state.vaos.updateWrite
  state.vaos.updateWrite = state.vaos.updateRead
  state.vaos.updateRead = updateTmp

  const renderTmp = state.vaos.renderWrite
  state.vaos.renderWrite = state.vaos.renderRead
  state.vaos.renderRead = renderTmp

  requestAnimationFrame((timestamp) => render(gl, state, timestamp))

}

const createBuffer = (gl, sizeOrData) => {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, sizeOrData, gl.STATIC_DRAW);
  return buffer;
}

const createBufferAndSetAttribute = (gl, data, loc) => {
  const buf = createBuffer(gl, data);
  // setup our attributes to tell WebGL how to pull
  // the data from the buffer above to the attribute
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(
      loc,
      1,         // size (num components)
      gl.FLOAT,  // type of data in buffer
      false,     // normalize
      0,         // stride (0 = auto)
      0,         // offset
  );
}


const main = async () => {
  const canvas = document.getElementById('canvas')
  const gl = canvas.getContext("webgl2")

  const particlesCount = 100;

  const positionBuffer = createBuffer
  const velocityBuffer = gl.createBuffer()


  const state = {
    previousTimestamp: Date.now(),
    updateProgram: await createUpdateProgram(gl),
    renderProgram: await createRenderProgram(gl),
    particlesCount,

    vaos: {

    }
  }

  requestAnimationFrame((timeDelta) => render(gl, state, timeDelta) )

};

main();