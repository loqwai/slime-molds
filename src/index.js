import { initAutoResize } from "./resize.js";
import { createInitialData, extractPositions } from "./createInitialData.js";

const PARTICLES_COUNT = 3
const TEXTURE_SIZE = 512
const SPORE_INTERVAL = 10

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

const getSporeTextureVertexShader = async (gl) => createShader(gl, gl.VERTEX_SHADER, './src/shaders/spore-texture-vertex-shader.glsl')
const getSporeTextureFragmentShader = async (gl) => createShader(gl, gl.FRAGMENT_SHADER, './src/shaders/spore-texture-fragment-shader.glsl')
const getParticleUpdateVertexShader = async (gl) => createShader(gl, gl.VERTEX_SHADER, './src/shaders/particle-update-vertex-shader.glsl')
const getParticleUpdateFragmentShader = async (gl) => createShader(gl, gl.FRAGMENT_SHADER, './src/shaders/particle-update-fragment-shader.glsl')
const getParticleRenderVertexShader = async (gl) => createShader(gl, gl.VERTEX_SHADER, './src/shaders/particle-render-vertex-shader.glsl')
const getParticleRenderFragmentShader = async (gl) => createShader(gl, gl.FRAGMENT_SHADER, './src/shaders/particle-render-fragment-shader.glsl')

const createSporeTextureProgram = async (gl) => {
  const program = gl.createProgram()

  gl.attachShader(program, await getSporeTextureVertexShader(gl))
  gl.attachShader(program, await getSporeTextureFragmentShader(gl))

  gl.linkProgram(program);

  const status = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!status) {
    throw new Error(`Could not link spore texture program. ${gl.getProgramInfoLog(program)}\n`);
  }
  return program;
}

const createUpdateProgram = async (gl) => {
  const program = gl.createProgram()

  gl.attachShader(program, await getParticleUpdateVertexShader(gl))
  gl.attachShader(program, await getParticleUpdateFragmentShader(gl))

  gl.transformFeedbackVaryings(
    program,
    ["outPosition", "outVelocity"],
    gl.INTERLEAVED_ATTRIBS,
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

const bindUpdateBuffer = (gl, program, vao, buffer) => {
  const positionAttrib = gl.getAttribLocation(program, 'inPosition')
  const velocityAttrib = gl.getAttribLocation(program, 'inVelocity')

  gl.bindVertexArray(vao);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.enableVertexAttribArray(positionAttrib);
  gl.vertexAttribPointer(positionAttrib, 2, gl.FLOAT, false, toBytes(4), 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.enableVertexAttribArray(velocityAttrib);
  gl.vertexAttribPointer(velocityAttrib, 2, gl.FLOAT, false, toBytes(4), toBytes(2));
}

const toBytes = (n) => n * Float32Array.BYTES_PER_ELEMENT

const bindSporeTextureBuffer = (gl, program, vao, vertexBuffer, textureBuffer) => {
  const positionAttrib = gl.getAttribLocation(program, 'inPosition')
  const textureAttrib = gl.getAttribLocation(program, 'inTexcoord')

  gl.bindVertexArray(vao);

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
  gl.enableVertexAttribArray(positionAttrib);
  gl.vertexAttribPointer(positionAttrib, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffer)
  gl.enableVertexAttribArray(textureAttrib);
  gl.vertexAttribPointer(textureAttrib, 2, gl.FLOAT, false, 0, 0);
}

const bindPositionBuffer = (gl, program, vao, buffer) => {
  const positionAttrib = gl.getAttribLocation(program, 'inPosition')

  gl.bindVertexArray(vao);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.enableVertexAttribArray(positionAttrib);
  gl.vertexAttribPointer(positionAttrib, 2, gl.FLOAT, false, toBytes(4), toBytes(0));
}

const calcTimeDelta = (oldTimestamp, newTimestamp) => {
  if (typeof oldTimestamp === 'undefined') return 0;
  return newTimestamp - oldTimestamp;
}

const render = (gl, state, timestamp) => {
  state.frameCount += 1

  const timeDelta = calcTimeDelta(state.oldTimestamp, timestamp)
  state.oldTimestamp = timestamp

  if (timeDelta > 60) {
    return requestAnimationFrame((timestamp) => render(gl, state, timestamp))
  }

  // Update
  {
    // Bind our program
    gl.useProgram(state.update.program)
    gl.uniform1f(state.update.attribs.timeDelta, timeDelta / 1000.0);
    gl.uniform1i(state.update.attribs.frameCount, state.frameCount);
    gl.uniform1i(state.update.attribs.sporeInterval, state.sporeInterval);

    // Bind our output texture
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, state.update.write.sporeTexture, 0);

    // Resize our viewport to match the output texture
    gl.viewport(0, 0, state.sporeTexture.width, state.sporeTexture.height)

    // Bind our particle data
    gl.bindVertexArray(state.update.read.vao); // input
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, state.update.write.buffer) // output
    // gl.enable(gl.RASTERIZER_DISCARD);
    gl.beginTransformFeedback(gl.POINTS);

    // Actually Run the Shader
    gl.drawArrays(gl.POINTS, 0, state.particlesCount);

    // Uncomment to debug the spore texture
    // if (state.frameCount % 100 === 1) {
    //   const dstData = new Uint8Array(4 * state.sporeTexture.width * state.sporeTexture.height);
    //   gl.readPixels(0, 0, state.sporeTexture.width, state.sporeTexture.height, gl.RGBA, gl.UNSIGNED_BYTE, dstData);
    //   console.log('dstData', dstData);
    // }

    // Cleanup
    gl.endTransformFeedback();
    // gl.disable(gl.RASTERIZER_DISCARD);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // Clear the screen
  {
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  // Render spore texture to Screen
  {
    gl.useProgram(state.sporeTexture.program);
    gl.bindTexture(gl.TEXTURE_2D, state.render.write.sporeTexture);
    gl.bindVertexArray(state.sporeTexture.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // // Render particles to Screen
  {
    gl.useProgram(state.render.program);
    gl.bindVertexArray(state.render.read.vao);
    gl.drawArrays(gl.POINTS, 0, state.particlesCount);
  }

  // Swap the read & write buffers
  const renderTmp = state.render.write
  state.render.write = state.render.read
  state.render.read = renderTmp

  const updateTmp = state.update.write
  state.update.write = state.update.read
  state.update.read = updateTmp

  if (state.frameCount % 10 === 0) {
    const fps = Math.round(1 / (timeDelta / 1000))
    document.getElementById('fps').innerText = `FPS: ${fps}`;
  }

  requestAnimationFrame((timestamp) => render(gl, state, timestamp))
}

const main = async () => {
  const canvas = document.getElementById('canvas')
  const gl = canvas.getContext("webgl2")
  const sporeTextureWidth = TEXTURE_SIZE;
  const sporeTextureHeight = sporeTextureWidth;

  initAutoResize(canvas)
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  const initialData = createInitialData(PARTICLES_COUNT)
  console.log('initialData', extractPositions(initialData))

  const buffer1 = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer1)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(initialData), gl.DYNAMIC_DRAW)
  console.log('buffer1', gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE))


  const buffer2 = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer2)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(initialData), gl.DYNAMIC_DRAW)

  const sporeTextureVertexBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, sporeTextureVertexBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    // triangle 1
    -1, -1,
    -1,  1,
     1, -1,
     // triangle 2
     1, -1,
    -1,  1,
     1,  1,
    ]), gl.STATIC_DRAW) // Two triangles covering the entire screen

  const sporeTextureTexcoordBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, sporeTextureTexcoordBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0, 0,
    0, 1,
    1, 0,
    1, 0,
    0, 1,
    1, 1,
  ]), gl.STATIC_DRAW) // Two triangles covering the entire screen

  const sporeTexture1 = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, sporeTexture1)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sporeTextureWidth, sporeTextureHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4 * sporeTextureWidth * sporeTextureHeight))
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.bindTexture(gl.TEXTURE_2D, null)

  const sporeTexture2 = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, sporeTexture2)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sporeTextureWidth, sporeTextureHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4 * sporeTextureWidth * sporeTextureHeight))
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.bindTexture(gl.TEXTURE_2D, null)

  const sporeTextureProgram = await createSporeTextureProgram(gl)
  const updateProgram = await createUpdateProgram(gl)
  const renderProgram = await createRenderProgram(gl)

  const readUpdateVao = gl.createVertexArray()
  bindUpdateBuffer(gl, updateProgram, readUpdateVao, buffer1)

  const writeUpdateVao = gl.createVertexArray()
  bindUpdateBuffer(gl, updateProgram, writeUpdateVao, buffer2)

  const readRenderVao = gl.createVertexArray()
  bindPositionBuffer(gl, renderProgram, readRenderVao, buffer2)

  const writeRenderVao = gl.createVertexArray()
  bindPositionBuffer(gl, renderProgram, writeRenderVao, buffer1)

  const sporeTextureVao = gl.createVertexArray()
  bindSporeTextureBuffer(gl, sporeTextureProgram, sporeTextureVao, sporeTextureVertexBuffer, sporeTextureTexcoordBuffer)

  gl.bindBuffer(gl.ARRAY_BUFFER, null)

  const state = {
    sporeTexture: {
      width: sporeTextureWidth,
      height: sporeTextureHeight,

      program: sporeTextureProgram,
      vao: sporeTextureVao,
      vertexBuffer: sporeTextureVertexBuffer,
      texcoordBuffer: sporeTextureTexcoordBuffer,
    },
    render: {
      program: renderProgram,
      attribs: {},
      read: {
        vao: readRenderVao,
        buffer: buffer2,
        sporeTexture: sporeTexture2,
      },
      write: {
        vao: writeRenderVao,
        buffer: buffer1,
        sporeTexture: sporeTexture1,
      }
    },
    update: {
      program: updateProgram,
      attribs: {
        frameCount: gl.getUniformLocation(updateProgram, "frameCount"),
        sporeInterval: gl.getUniformLocation(updateProgram, "sporeInterval"),
        timeDelta: gl.getUniformLocation(updateProgram, "timeDelta"),
      },
      read: {
        vao: readUpdateVao,
        buffer: buffer1,
        sporeTexture: sporeTexture1,
      },
      write: {
        vao: writeUpdateVao,
        buffer: buffer2,
        sporeTexture: sporeTexture2,
      }
    },
    particlesCount: PARTICLES_COUNT,
    sporeInterval: SPORE_INTERVAL,
    oldTimestamp: undefined,
    frameCount: 0,
  }

  requestAnimationFrame((timeDelta) => render(gl, state, timeDelta) )
};

main();