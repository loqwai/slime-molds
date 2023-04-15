
const fetchShader = async (filename) => (await fetch(filename)).text()

/**
 * @param {WebGL2RenderingContext} gl
 * @param {number} type
 * @param {string} filename
 * @returns {WebGLShader}
*/
export const createShader = async (gl, type, filename) => {
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
const getSporeTextureVertexShader = async (gl, basePath) => createShader(gl, gl.VERTEX_SHADER, `${basePath}/spore-texture-vertex-shader.glsl`)
const getSporeTextureFragmentShader = async (gl, basePath) => createShader(gl, gl.FRAGMENT_SHADER, `${basePath}/spore-texture-fragment-shader.glsl`)
const getParticleUpdateVertexShader = async (gl, basePath) => createShader(gl, gl.VERTEX_SHADER, `${basePath}/particle-update-vertex-shader.glsl`)
const getParticleUpdateFragmentShader = async (gl, basePath) => createShader(gl, gl.FRAGMENT_SHADER, `${basePath}/particle-update-fragment-shader.glsl`)
const getParticleRenderVertexShader = async (gl, basePath) => createShader(gl, gl.VERTEX_SHADER, `${basePath}/particle-render-vertex-shader.glsl`)
const getParticleRenderFragmentShader = async (gl, basePath) => createShader(gl, gl.FRAGMENT_SHADER, `${basePath}/particle-render-fragment-shader.glsl`)

/**
 * Renders the spore texture program. The spore texture is a 2D texture that
 * stores all the spores generated by the particles. That texture & spore generation
 * is handled by the update program. This only renders the texture. It's also used to
 * implement the spore decay logic by fading out each pixel over time. That means this
 * program will still be executed if spore rendering is disabled, it just won't be shown
 * on the screen.
 * @param {WebGL2RenderingContext} gl
 * @param {string} shaderBasePath
 * @returns {Promise<WebGLProgram>}
 */
export const createSporeTextureProgram = async (gl, shaderBasePath) => {
  const program = gl.createProgram()

  gl.attachShader(program, await getSporeTextureVertexShader(gl, shaderBasePath))
  gl.attachShader(program, await getSporeTextureFragmentShader(gl, shaderBasePath))

  gl.linkProgram(program);

  const status = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!status) {
    throw new Error(`Could not link spore texture program. ${gl.getProgramInfoLog(program)}\n`);
  }
  return program;
}

/**
 * creates the update program. The update program is responsible for updating
 * the position, velocity, and color of each particle. Those three attributes
 * are stored in a single buffer and are interleaved. The update program
 * outputs the updated attributes to a transform feedback buffer.
 * @param {WebGL2RenderingContext} gl
 * @param {string} shaderBasePath
 * @returns {Promise<WebGLProgram>}
 */
export const createUpdateProgram = async (gl, shaderBasePath) => {
  const program = gl.createProgram()

  gl.attachShader(program, await getParticleUpdateVertexShader(gl, shaderBasePath))
  gl.attachShader(program, await getParticleUpdateFragmentShader(gl, shaderBasePath))

  gl.transformFeedbackVaryings(
    program,
    ["outPosition", "outVelocity", "outColor"],
    gl.INTERLEAVED_ATTRIBS,
  )

  gl.linkProgram(program);

  const status = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!status) {
    throw new Error(`Could not link update program. ${gl.getProgramInfoLog(program)}\n`);
  }
  return program;
}

const toBytes = (n) => n * Float32Array.BYTES_PER_ELEMENT

/**
 * Creates the render program. The render program is responsible for rendering
 * the particles to the screen. The render program takes the updated attributes
 * from the transform feedback buffer and renders them to the screen.
 * @param {WebGL2RenderingContext} gl
 * @param {string} shaderBasePath
 * @returns {Promise<WebGLProgram>}
 */
export const createRenderProgram = async (gl, shaderBasePath) => {
  const program = gl.createProgram()

  gl.attachShader(program, await getParticleRenderVertexShader(gl, shaderBasePath))
  gl.attachShader(program, await getParticleRenderFragmentShader(gl, shaderBasePath))

  gl.linkProgram(program);

  const status = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!status) {
    throw new Error(`Could not link render program. ${gl.getProgramInfoLog(program)}\n`);
  }
  return program;
}

/**
 * Tags webgl objects with names so that the debug helper extension can display them
 * @param {WebGL2RenderingContext} gl
 * @param {WebGLTexture | WebGLProgram | WebGLVertexArrayObject | WebGLFramebuffer} obj
 * @param {string} tag
 * @returns
 */
export const tagObject = (gl, obj, tag) => {
  const ext = gl.getExtension('GMAN_debug_helper');
  if (!ext) return;
  ext.tagObject(obj, tag);
}

/**
 * Binds the update buffer array properties to the update program
 * @param {WebGL2RenderingContext} gl
 * @param {WebGLProgram} program
 * @param {WebGLVertexArrayObject} vao
 * @param {WebGLBuffer} vertexBuffer
 */
export const bindUpdateBuffer = (gl, program, vao, vertexBuffer) => {
  const positionAttrib = gl.getAttribLocation(program, 'inPosition')
  const velocityAttrib = gl.getAttribLocation(program, 'inVelocity')
  const colorAttrib = gl.getAttribLocation(program, 'inColor')

  gl.bindVertexArray(vao);

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
  gl.enableVertexAttribArray(positionAttrib);
  gl.vertexAttribPointer(positionAttrib, 3, gl.FLOAT, false, toBytes(8), 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
  gl.enableVertexAttribArray(velocityAttrib);
  gl.vertexAttribPointer(velocityAttrib, 2, gl.FLOAT, false, toBytes(8), toBytes(2));

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
  gl.enableVertexAttribArray(colorAttrib);
  gl.vertexAttribPointer(colorAttrib, 4, gl.FLOAT, false, toBytes(8), toBytes(4));
}

/**
 * Binds the particle position buffer to the render program
 * @param {WebGL2RenderingContext} gl
 * @param {WebGLProgram} program
 * @param {WebGLVertexArrayObject} vao
 * @param {WebGLBuffer} buffer
 */
export const bindPositionBuffer = (gl, program, vao, buffer) => {
  const positionAttrib = gl.getAttribLocation(program, 'inPosition')

  gl.bindVertexArray(vao);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.enableVertexAttribArray(positionAttrib);
  gl.vertexAttribPointer(positionAttrib, 2, gl.FLOAT, false, toBytes(8), toBytes(0));
}

/**
 * Binds the spore texture buffer to the spore render program
 * @param {WebGL2RenderingContext} gl
 * @param {WebGLProgram} program
 * @param {WebGLVertexArrayObject} vao
 * @param {WebGLBuffer} buffer
 * @param {WebGLBuffer} textureBuffer
 */
export const bindSporeTextureBuffer = (gl, program, vao, vertexBuffer, textureBuffer) => {
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