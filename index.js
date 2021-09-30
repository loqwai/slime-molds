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

const render = (gl, state) => {
  // Render
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(state.renderProgram);
  gl.bindVertexArray(state.vaos.render.read);
  gl.drawArrays(gl.POINTS, 0, state.particlesCount);

  // for (let i = 0; i < state.particlesCount; i++) {
  //   const debug = gl.getVertexAttrib(i, gl.CURRENT_VERTEX_ATTRIB)
  //   console.log('postrender', i, debug)
  // }
  requestAnimationFrame((timestamp) => render(gl, state, timestamp))
}

const createInitialData = (n) => {
  const data = []

  for (let i = 0; i < n; i++){
    // position

    const x = ((i / n) * 2) - 1 // -1 <= x <= 1

    data.push(x)
    data.push(x)

    // // velocity
    const vx = -1 * ((i / n) * 2) - 1 // -1 <= x <= 1

    data.push(vx)
    data.push(0)
  }

  return new Float32Array(data)
}

const bindUpdateBuffer = (gl, program, vao, buffer) => {
  const b = Float32Array.BYTES_PER_ELEMENT

  const updatePositionAttrib = gl.getAttribLocation(program, 'inPosition')
  const updateVelocityAttrib = gl.getAttribLocation(program, 'inVelocity')

  gl.bindVertexArray(vao);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.enableVertexAttribArray(updatePositionAttrib);
  gl.vertexAttribPointer(updatePositionAttrib, 2, gl.FLOAT, false, toBytes(4), 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.enableVertexAttribArray(updateVelocityAttrib);
  gl.vertexAttribPointer(updateVelocityAttrib, 2, gl.FLOAT, false, toBytes(4), toBytes(2));
}

const toBytes = (n) => n * Float32Array.BYTES_PER_ELEMENT

const bindPositionBuffer = (gl, program, vao, buffer) => {
  const positionAttrib = gl.getAttribLocation(program, 'inPosition')

  gl.bindVertexArray(vao);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.enableVertexAttribArray(positionAttrib);
  gl.vertexAttribPointer(positionAttrib, 2, gl.FLOAT, false, toBytes(4), toBytes(0));
}


const main = async () => {
  const canvas = document.getElementById('canvas')
  const gl = canvas.getContext("webgl2")

  initAutoResize(canvas)
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  const particlesCount = 100
  const initialData = createInitialData(particlesCount)

  const buffer1 = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer1)
  gl.bufferData(gl.ARRAY_BUFFER, initialData, gl.STATIC_DRAW)

  const buffer2 = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer2)
  gl.bufferData(gl.ARRAY_BUFFER, initialData, gl.STATIC_DRAW)

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

  const state = {
    renderProgram,
    particlesCount,
    vaos: {
      render: {read: readRenderVao, write: writeRenderVao},
      update: {read: readUpdateVao, write: writeUpdateVao},
    },
  }

  requestAnimationFrame((timeDelta) => render(gl, state, timeDelta) )
};

main();