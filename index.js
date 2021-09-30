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

const getParticleRenderVertexShader = async (gl) => createShader(gl, gl.VERTEX_SHADER, 'particle-render-vertex-shader.glsl')
const getParticleRenderFragmentShader = async (gl) => createShader(gl, gl.FRAGMENT_SHADER, 'particle-render-fragment-shader.glsl')

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
  gl.bindVertexArray(state.vaos.renderRead);
  gl.drawArrays(gl.POINTS, 0, state.particlesCount);

  // for (let i = 0; i < state.particlesCount; i++) {
  //   const debug = gl.getVertexAttrib(i, gl.CURRENT_VERTEX_ATTRIB)
  //   console.log('postrender', i, debug)
  // }
  // requestAnimationFrame((timestamp) => render(gl, state, timestamp))
}

const createInitialData = (n) => {
  const data = []

  for (let i = 0; i < n; i++){
    const x = ((i / n) * 2) - 1 // -1 <= x <= 1

    data.push(x)
    data.push(x)
  }

  return new Float32Array(data)
}


const main = async () => {
  const canvas = document.getElementById('canvas')
  const gl = canvas.getContext("webgl2")

  initAutoResize(canvas)
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  const renderProgram = await createRenderProgram(gl)
  const positionAttrib = gl.getAttribLocation(renderProgram, 'i_Position')

  const particlesCount = 100
  const initialData = createInitialData(particlesCount)

  const positionBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, initialData, gl.STATIC_DRAW)

  const vao = gl.createVertexArray()
  gl.bindVertexArray(vao);
  gl.enableVertexAttribArray(positionAttrib);
  gl.vertexAttribPointer(positionAttrib, 2, gl.FLOAT, false, 0, 0);

  const state = {
    renderProgram,
    particlesCount,
    vaos: {
      renderRead: vao,
    },
  }

  requestAnimationFrame((timeDelta) => render(gl, state, timeDelta) )

};

main();