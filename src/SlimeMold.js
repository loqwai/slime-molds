import { initAutoResize } from "./resize.js";
import {
  createSporeTextureProgram,
  createUpdateProgram,
  createRenderProgram,
  bindUpdateBuffer,
  bindPositionBuffer,
  bindSporeTextureBuffer,
  tagObject,
} from "./shaderUtils.js";
import { createInitialData } from "./createInitialData.js";

const PARTICLES_COUNT = Math.pow(10, 5);
const TEXTURE_SIZE = 2048;
const SPORE_INTERVAL = 1;
const TARGET_FPS = 60;
const RENDER_PARTICLES = false;
const RENDER_SPORES = true;

class SlimeMold {
  /**
   * @param {!HTMLCanvasElement} canvas
   * @param {string} shaderPathPrefix
   */
  constructor(
    canvas,
    shaderPathPrefix = "https://raw.githubusercontent.com/loqwai/slime-molds/main/src/shaders"
  ) {
    this.canvas = canvas;
    this.gl = this.canvas.getContext("webgl2");
    this.running = false;
    this.shaderPathPrefix = shaderPathPrefix;
    this.parameters = {
      turnRate: 0.8,
      velocityMultiplier: 1.0,
      sporeSize: 4.0,
      range: 0.06,
    };
  }

  setTurnRate = (turnRate) => {
    this.parameters.turnRate = turnRate;
  };

  setVelocityMultiplier = (velocityMultiplier) => {
    this.parameters.velocityMultiplier = velocityMultiplier;
  };

  setSporeSize = (sporeSize) => {
    this.parameters.sporeSize = sporeSize;
  };

  setRange = (range) => {
    this.parameters.range = range;
  };

  stop = () => {
    this.running = false;
  };

  calcTimeDelta = (oldTimestamp, newTimestamp) => {
    if (typeof oldTimestamp === "undefined") return 0;
    return newTimestamp - oldTimestamp;
  };

  draw = (timestamp) => {
    if (!this.running) {
      return;
    }

    const state = this.state;
    const gl = this.gl;

    state.frameCount += 1;

    const timeDelta = this.calcTimeDelta(state.oldTimestamp, timestamp);
    state.oldTimestamp = timestamp;

    if (TARGET_FPS > 20 && timeDelta > 60) {
      return requestAnimationFrame(this.draw);
    }

    // Update
    {
      // Bind our output texture
      const fb = gl.createFramebuffer();
      tagObject(gl, fb, "output texture");
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        state.update.write.sporeTexture,
        0
      );

      // enable blending of output so that transparency in the particle layer shows the spore texture instead
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      // Resize our viewport to match the output texture
      gl.viewport(0, 0, state.sporeTexture.width, state.sporeTexture.height);

      // Render spore texture to Screen
      {
        gl.useProgram(state.sporeTexture.program);
        gl.bindTexture(gl.TEXTURE_2D, state.render.write.sporeTexture);
        gl.bindVertexArray(state.sporeTexture.vao);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.bindTexture(gl.TEXTURE_2D, null);
      }

      // Bind our update program
      {
        gl.useProgram(state.update.program);
        gl.uniform1f(state.update.attribs.timeDelta, timeDelta / 1000.0);
        gl.uniform1i(state.update.attribs.frameCount, state.frameCount);
        gl.uniform1i(state.update.attribs.sporeInterval, state.sporeInterval);
        gl.uniform1f(state.update.attribs.turnRate, this.parameters.turnRate);
        gl.uniform1f(
          state.update.attribs.velocityMultiplier,
          this.parameters.velocityMultiplier
        );
        gl.uniform1f(state.update.attribs.sporeSize, this.parameters.sporeSize);
        gl.uniform1f(state.update.attribs.range, this.parameters.range);
        gl.bindTexture(gl.TEXTURE_2D, state.update.read.sporeTexture);
      }

      // Bind our particle data
      gl.bindVertexArray(state.update.read.vao); // input
      gl.bindBufferBase(
        gl.TRANSFORM_FEEDBACK_BUFFER,
        0,
        state.update.write.buffer
      ); // output
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
      gl.disable(gl.BLEND);
      gl.endTransformFeedback();
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        null,
        0
      );
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    // Clear the screen
    {
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.clearColor(7 / 256, 59 / 256, 76 / 256, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE_MINUS_DST_COLOR, gl.ONE);
    }

    // // Render spore texture to Screen
    if (RENDER_SPORES) {
      gl.useProgram(state.sporeTexture.program);
      gl.bindTexture(gl.TEXTURE_2D, state.render.write.sporeTexture);
      gl.bindVertexArray(state.sporeTexture.vao);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }

    // Render particles to Screen
    if (RENDER_PARTICLES) {
      gl.useProgram(state.render.program);
      gl.bindVertexArray(state.render.read.vao);
      gl.drawArrays(gl.POINTS, 0, state.particlesCount);
    }

    gl.disable(gl.BLEND);

    // Swap the read & write buffers
    const renderTmp = state.render.write;
    state.render.write = state.render.read;
    state.render.read = renderTmp;

    const updateTmp = state.update.write;
    state.update.write = state.update.read;
    state.update.read = updateTmp;

    this.fps = Math.round(1 / (timeDelta / 1000));

    if (TARGET_FPS === 60) {
      requestAnimationFrame(this.draw);
    } else {
      setTimeout(() => this.draw(performance.now()), 1000 / TARGET_FPS);
    }
  };

  start = async () => {
    this.running = true;
    initAutoResize(this.canvas);
    const sporeTextureWidth = TEXTURE_SIZE;
    const sporeTextureHeight = sporeTextureWidth;
    const gl = this.gl;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    const initialData = createInitialData(PARTICLES_COUNT);

    const buffer1 = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer1);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(initialData),
      gl.DYNAMIC_DRAW
    );

    const buffer2 = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer2);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(initialData),
      gl.DYNAMIC_DRAW
    );

    const sporeTextureVertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sporeTextureVertexBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        // triangle 1
        -1, -1, -1, 1, 1, -1,
        // triangle 2
        1, -1, -1, 1, 1, 1,
      ]),
      gl.STATIC_DRAW
    ); // Two triangles covering the entire screen

    const sporeTextureTexcoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sporeTextureTexcoordBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        // triangle 1
        0, 0, 0, 1, 1, 0,
        // triangle 2
        1, 0, 0, 1, 1, 1,
      ]),
      gl.STATIC_DRAW
    ); // Two triangles covering the entire texture

    const sporeTexture1 = gl.createTexture();
    tagObject(gl, sporeTexture1, "sporeTexture1");
    gl.bindTexture(gl.TEXTURE_2D, sporeTexture1);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      sporeTextureWidth,
      sporeTextureHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array(4 * sporeTextureWidth * sporeTextureHeight)
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    const sporeTexture2 = gl.createTexture();
    tagObject(gl, sporeTexture2, "sporeTexture2");
    gl.bindTexture(gl.TEXTURE_2D, sporeTexture2);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      sporeTextureWidth,
      sporeTextureHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array(4 * sporeTextureWidth * sporeTextureHeight)
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    const sporeTextureProgram = await createSporeTextureProgram(
      gl,
      this.shaderPathPrefix
    );
    const updateProgram = await createUpdateProgram(gl, this.shaderPathPrefix);
    const renderProgram = await createRenderProgram(gl, this.shaderPathPrefix);
    tagObject(gl, sporeTextureProgram, "sporeTextureProgram");
    tagObject(gl, updateProgram, "updateProgram");
    tagObject(gl, renderProgram, "renderProgram");

    const readUpdateVao = gl.createVertexArray();
    tagObject(gl, readUpdateVao, "readUpdateVao");
    bindUpdateBuffer(gl, updateProgram, readUpdateVao, buffer1);

    const writeUpdateVao = gl.createVertexArray();
    tagObject(gl, writeUpdateVao, "writeUpdateVao");
    bindUpdateBuffer(gl, updateProgram, writeUpdateVao, buffer2);

    const readRenderVao = gl.createVertexArray();
    tagObject(gl, readRenderVao, "readRenderVao");
    bindPositionBuffer(gl, renderProgram, readRenderVao, buffer2);

    const writeRenderVao = gl.createVertexArray();
    tagObject(gl, writeRenderVao, "writeRenderVao");
    bindPositionBuffer(gl, renderProgram, writeRenderVao, buffer1);

    const sporeTextureVao = gl.createVertexArray();
    tagObject(gl, sporeTextureVao, "sporeTextureVao");
    bindSporeTextureBuffer(
      gl,
      sporeTextureProgram,
      sporeTextureVao,
      sporeTextureVertexBuffer,
      sporeTextureTexcoordBuffer
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this.state = {
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
        },
      },
      update: {
        program: updateProgram,
        attribs: {
          frameCount: gl.getUniformLocation(updateProgram, "frameCount"),
          sporeInterval: gl.getUniformLocation(updateProgram, "sporeInterval"),
          timeDelta: gl.getUniformLocation(updateProgram, "timeDelta"),
          turnRate: gl.getUniformLocation(updateProgram, "turnRate"),
          velocityMultiplier: gl.getUniformLocation(
            updateProgram,
            "velocityMultiplier"
          ),
          sporeSize: gl.getUniformLocation(updateProgram, "sporeSize"),
          range: gl.getUniformLocation(updateProgram, "range"),
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
        },
      },
      particlesCount: PARTICLES_COUNT,
      sporeInterval: SPORE_INTERVAL,
      oldTimestamp: undefined,
      frameCount: 0,
    };

    requestAnimationFrame(this.draw);
  };
}

export { SlimeMold };
