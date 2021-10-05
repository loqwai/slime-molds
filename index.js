import { initAutoResize } from "./resize.js";

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

const createInitialData = (n) => {
  const data = []

  const maxX = Math.sqrt(n);
  const maxY = Math.sqrt(n);

  for (let x = 0; x < maxX; x++) {
    for (let y = 0; y < maxY; y++) {
      const posX = (2 * x / maxX) - 1
      const posY = (2 * y / maxY) - 1

      const velX = -0.5 * posX
      const velY = -0.5 * posY

      data.push(posX)
      data.push(posY)
      data.push(velX)
      data.push(velY)
    }
  }

  return data
}

const bindUpdateBuffer = (gl, program, vao, buffer) => {
  const b = Float32Array.BYTES_PER_ELEMENT

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

  // Update
  gl.useProgram(state.update.program)
  gl.uniform1f(state.update.attribs.timeDelta, timeDelta / 1000.0);
  gl.bindVertexArray(state.update.read.vao);

  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, state.update.write.buffer)
  gl.enable(gl.RASTERIZER_DISCARD);
  gl.beginTransformFeedback(gl.POINTS);
  gl.drawArrays(gl.POINTS, 0, state.particlesCount);
  gl.endTransformFeedback();
  gl.disable(gl.RASTERIZER_DISCARD);
  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);

  // Render
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(state.render.program);
  gl.bindVertexArray(state.render.read.vao);
  gl.drawArrays(gl.POINTS, 0, state.particlesCount);

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

  initAutoResize(canvas)
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  const particlesCount = 10000
  const initialData = createInitialData(particlesCount)

  const buffer1 = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer1)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(initialData), gl.DYNAMIC_DRAW)

  const buffer2 = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer2)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(initialData), gl.DYNAMIC_DRAW)

  const sporeTexture1 = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, sporeTexture1)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 10, 10, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4 * 100))

  const sporeTexture2 = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_3D, sporeTexture2)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 10, 10, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4 * 100))

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

  gl.bindBuffer(gl.ARRAY_BUFFER, null)

  const state = {
    render: {
      program: renderProgram,
      attribs: {},
      read: {
        vao: readRenderVao,
        buffer: buffer2,
      },
      write: {
        vao: writeRenderVao,
        buffer: buffer1,
      }
    },
    update: {
      program: updateProgram,
      attribs: {
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
    particlesCount,
    oldTimestamp: undefined,
    frameCount: 0,
  }

  requestAnimationFrame((timeDelta) => render(gl, state, timeDelta) )
};

main();