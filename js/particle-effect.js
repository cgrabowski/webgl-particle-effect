function ParticleEffect (gl, vMatrix, pMatrix, vertId, fragId, shaderSourceType, callback, defaultOpts, emittersOpts) {
  if (arguments.length === 0)
    return
  if (!gl || !gl instanceof WebGLRenderingContext)
    throw new Error('ParticleEffect requires a valid gl context')

  var textFac = ParticleEffect.textureFactory

  this.gl = gl
  this.vMatrix = vMatrix || mat4.create()
  this.pMatrix = pMatrix || mat4.perspective(mat4.create(), 0.79, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0)
  this.mvMatrix = mat4.create()
  this.emitters = []
  this.textureSources = []
  this.oldTime = new Date().getTime()
  this.delta = 0

  if (!vMatrix) {
    mat4.lookAt(this.vMatrix, [-1, 0, 5], [0, 0, -5], [0, 1, 0])
    mat4.translate(this.vMatrix, this.vMatrix, [0.0, -1.0, -15.0])
  }

  if (vertId && fragId) {
    this.createShaderProgram(gl, vertId, fragId, shaderSourceType)
  } else {
    this.createShaderProgram(gl, ParticleEffect.defaultVertexShader(), ParticleEffect.defaultFragmentShader(), 'array')
  }

  for (var i = 0; i < emittersOpts.length /*!*/ - 1 /*!*/; i++) {
    var opts = {}
    for (var opt in defaultOpts)
      opts[opt] = defaultOpts[opt]
    for (opt in opts) {
      if (emittersOpts[i + 1][opt]) {
        opts[opt] = emittersOpts[i + 1][opt]
      } else if (emittersOpts[0][opt]) {
        opts[opt] = emittersOpts[0][opt]
      }
    }
    this.textureSources[i] = emittersOpts[i + 1].textSource || emittersOpts[0].textSource
    this.emitters[i] = new ParticleEmitter(this, opts, i)
  }

  textFac(this.textureSources, assignTextures)

  var self = this
  function assignTextures () {
    for (i = 0; i < textFac.textures.length; i++)
      self.emitters[i].texture = textFac.textures[i]
    callback()
  }
}

ParticleEffect.prototype = {
  constructor: ParticleEffect,
  render: function () {
    var newTime = new Date().getTime()
    this.delta = newTime - this.oldTime
    this.oldTime = newTime
    var ln = this.emitters.length
    for (var i = 0; i < ln; i++)
      this.emitters[i].render(this.delta)
  },
  createShaderProgram: function (gl, vertex, fragment, sourceType) {
    var fragmentShader
      , vertexShader
      , prog = this.shaderProgram = gl.createProgram()

    sourceType = sourceType.toLowerCase()
    if (sourceType === 'html') {
      vertexShader = this.getShaderFromHTML(gl, vertex)
      fragmentShader = this.getShaderFromHTML(gl, fragment)
    } else if (sourceType === 'string') {
      vertexShader = this.getshaderFromString(gl, vertex, 'vertex')
      fragmentShader = this.getShaderFromString(gl, fragment, 'fragment')
    } else if (sourceType === 'array') {
      vertexShader = this.getShaderFromArray(gl, vertex, 'vertex')
      fragmentShader = this.getShaderFromArray(gl, fragment, 'fragment')
    } else {
      throw new Error('sourceType parameter must be "html", "string", or "array"')
    }

    gl.attachShader(prog, vertexShader)
    gl.attachShader(prog, fragmentShader)
    gl.linkProgram(prog)

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
      throw new Error("Could not initialize shaders")

    gl.useProgram(prog)
    prog.vertexPositionAttribute = gl.getAttribLocation(prog, "aVertexPosition")
    gl.enableVertexAttribArray(prog.vertexPositionAttribute)
    prog.textureCoordAttribute = gl.getAttribLocation(prog, "aTextureCoord")
    gl.enableVertexAttribArray(prog.textureCoordAttribute)
    prog.pMatrixUniform = gl.getUniformLocation(prog, "uPMatrix")
    prog.mvMatrixUniform = gl.getUniformLocation(prog, "uMVMatrix")
    prog.samplerUniform = gl.getUniformLocation(prog, "uSampler")
  },
  getShaderFromHTML: function (gl, id) {
    var str = ""
      , shaderScript = document.getElementById(id)
      , shader
      , type

    if (!shaderScript)
      return null

    var k = shaderScript.firstChild
    while (k) {
      if (k.nodeType === 3)
        str += k.textContent
      k = k.nextSibling
    }

    if (shaderScript.type === "x-shader/x-vertex") {
      type = 'vertex'
    } else if (shaderScript.type === "x-shader/x-fragment") {
      type = 'fragment'
    } else {
      throw new Error('Shader mime type must be "x-shader/x-vertex" or "x-shader/x-fragment"')
      return null
    }
    return this.getShaderFromString(gl, str, type)
  },
  getShaderFromArray: function (gl, array, type) {
    var str = array.join('')
    return this.getShaderFromString(gl, str, type)
  },
  getShaderFromString: function (gl, str, type) {
    var shader
    if (type === 'vertex') {
      shader = gl.createShader(gl.VERTEX_SHADER)
    } else if (type === 'fragment') {
      shader = gl.createShader(gl.FRAGMENT_SHADER)
    } else {
      throw new Error('shader type parameter must be "vertex" or "fragment"')
      return null
    }
    gl.shaderSource(shader, str)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error('Error compiling ' + type + ' shader')
      return null
    }
    return shader
  },
  initBuffers: function () {
    this.vertBuff = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertBuff)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.vertices), gl.STATIC_DRAW)

    this.textCoordBuff = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.textCoordBuff)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.textCoords), gl.STATIC_DRAW)

    this.indexBuff = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuff)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.indices), gl.STATIC_DRAW)
  },
  replaceTexture: function (image, index, callback) {
    var texture = gl.createTexture()
      // emitters can call this method if index is null or undefined
      // if index is defined and not null, 
      // the method looks for an array of emitters named emitters
      , oldTexture = (index === null || (typeof(index) === 'undefined')) ? this.texture : this.emitters[index].texture

    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.bindTexture(gl.TEXTURE_2D, null)
    ParticleEffect.textureFactory.textures[index] = texture

    if (index === null || (typeof(index) === 'undefined'))
      this.texture = texture
    else
      this.emitters[index].texture = texture

    gl.deleteTexture(oldTexture)

    if (callback)
      callback(texture, index)
  }
}


ParticleEffect.textureFactory = function (sources, callback) {
  if (typeof(sources) === 'string')
    sources = [sources]

  var numLoaded = 0

  for (var i = 0; i < sources.length; i++) {
    ParticleEffect.textureFactory.textures[i] = ParticleEffect.initTexture(sources[i], function () {
      if (++numLoaded === sources.length)
        callback()
    })
  }
}

ParticleEffect.textureFactory.textures = []

ParticleEffect.initTexture = function (src, callback) {
  var texture = gl.createTexture()
  texture.image = new Image()
  texture.image.onload = function () {
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.bindTexture(gl.TEXTURE_2D, null)
    if (callback)
      callback(texture)
  }
  texture.image.src = src
  return texture
}

ParticleEffect.disposeTextures = function () {
  for (var i = 0; i < ParticleEffect.textureFactory.textures.length; i++)
    gl.deleteTexture(ParticleEffect.textureFactory.textures[i])
}

ParticleEffect.defaultVertexShader = function () {
  var vArray = []
  vArray[0] = 'attribute vec3 aVertexPosition;'
  vArray[1] = 'attribute vec2 aTextureCoord;'
  vArray[2] = 'uniform mat4 uMVMatrix;'
  vArray[3] = 'uniform mat4 uPMatrix;'
  vArray[4] = 'varying vec2 vTextureCoord;'
  vArray[5] = 'void main(void) {'
  vArray[6] = 'gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);'
  vArray[7] = 'vTextureCoord = aTextureCoord;'
  vArray[8] = '}'
  return vArray
}

ParticleEffect.defaultFragmentShader = function () {
  var fArray = []
  fArray[0] = 'precision mediump float;'
  fArray[1] = 'varying vec2 vTextureCoord;'
  fArray[2] = 'uniform sampler2D uSampler;'
  fArray[3] = 'void main(void) {'
  fArray[4] = 'vec4 tmp = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));'
  fArray[5] = 'gl_FragColor = tmp;'
  fArray[6] = '}'
  return fArray
}

function ParticleEmitter (effect, opts, index) {
  var rp = ParticleEmitter.randlerp
  this.effect = effect || null

  for (var opt in opts) {
    if (opt === 'name') {
      this.name = opts.name || ((index) ? "emitter " + index : "unamed effect")
    } else {
      this[opt] = opts[opt]
    }
  }

  this.opts = {}
  for (var opt in opts) {
    if (typeof this[opt] !== 'undefined')
      this.opts[opt] = this[opt]
  }

  this.matrix = mat4.create()
  this.lives = []
  this.lifeElapsed = []
  this.starts = []
  this.directions = []
  this.speeds = []
  this.rotations = []

  this.vertices = [-0.1, -0.1, 0.1, 0.1, -0.1, 0.1, 0.1, 0.1, 0.1, -0.1, 0.1, 0.1]
  this.textCoords = [0, 0, 1, 0, 1, 1, 0, 1]
  this.indices = [0, 1, 2, 0, 2, 3]

  for (i = 0; i < opts.maxParticles; i++) {
    this.lives.push(rp(opts.minLife, opts.maxLife, true))
    this.lifeElapsed.push(-rp(opts.minDelay, opts.maxDelay, true))
    this.starts.push(rp(opts.minOffsetX, opts.maxOffsetX), rp(opts.minOffsetY, opts.maxOffsetY), rp(opts.minOffsetZ, opts.maxOffsetZ))
    this.directions.push(rp(opts.minDirX, opts.maxDirX), rp(opts.minDirY, this.maxDirY), rp(opts.minDirZ, opts.maxDirZ))
    this.speeds.push(rp(opts.minSpeed, opts.maxSpeed))
    this.rotations.push(rp(opts.minRot, opts.maxRot))
  }

  this.vertId = opts.vertId || null
  this.fragId = opts.fragId || null
  if (opts.vertId && opts.fragId)
    this.createShaderProgram(effect.gl, opts.VertId, opts.FragId)
  else
    this.shaderProgram = effect.shaderProgram

  this.initBuffers()

  var matrix = this.matrix
    , vMatrix = this.effect.vMatrix
    , pMatrix = this.effect.pMatrix

}

ParticleEmitter.prototype = new ParticleEffect
ParticleEmitter.prototype.constructor = ParticleEmitter

ParticleEmitter.prototype.render = function (delta) {
  var gl = this.effect.gl
    , numParticles = this.maxParticles
    , text = this.texture
    , shaderProgram = (this.shaderProgram || effect.shaderProgram)

    , matrix = this.matrix
    , vMatrix = this.effect.vMatrix
    , pMatrix = this.effect.pMatrix

    , minLife = this.minLife
    , maxLife = this.maxLife
    , minDelay = this.minDelay
    , maxDelay = this.maxDelay

    , minDirX = this.minDirX
    , maxDirX = this.maxDirX
    , minDirY = this.minDirY
    , maxDirY = this.maxDirY
    , minDirZ = this.minDirZ
    , maxDirZ = this.maxDirZ

    , lives = this.lives
    , elapsed = this.lifeElapsed
    , lifeLen = this.lives.length

    , starts = this.starts
    , speeds = this.speeds
    , directions = this.directions
    , rotations = this.rotations

    , rp = ParticleEmitter.randlerp
    , m4 = mat4

  //resurect dead particles with fresh randomized props
  for (var i = 0; i < lifeLen; i++) {
    // particle gets older
    elapsed[i] += delta
    // if particle's life is elapsed, it needs resurected
    if (elapsed[i] > lives[i]) {
      // new lifespan
      lives[i] = rp(minLife, maxLife, true)
      // new start point
      starts.splice(i * 3, 3, rp(this.minOffsetX, this.maxOffsetX), rp(this.minOffsetY, this.maxOffsetY), rp(this.minOffsetZ, this.maxOffsetZ))
      // reset elapsed (negative elapsed creates delay)
      elapsed[i] = (-rp(minDelay, maxDelay))
      // determine a new directional vector
      directions.splice(i * 3, 3, rp(minDirX, maxDirX), rp(minDirY, maxDirY), rp(minDirZ, maxDirZ))

      speeds[i] = rp(this.minSpeed, this.maxSpeed)
      rotations[i] = rp(this.minRot, this.maxRot)
    }

  }

  gl.bindBuffer(gl.ARRAY_BUFFER, this.vertBuff)
  gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0)
  gl.bindBuffer(gl.ARRAY_BUFFER, this.textCoordBuff)
  gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, 2, gl.FLOAT, false, 0, 0)
  gl.uniform1i(shaderProgram.samplerUniform, 0)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuff)
  gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix)
  gl.bindTexture(gl.TEXTURE_2D, this.texture)

  for (i = 0; i < numParticles; i++) {
    // if elapsed is negative, the particle is delayed
    if (elapsed[i] < 0)
      continue
    m4.identity(matrix)
    m4.translate(matrix, matrix, [
      starts[i * 3] + elapsed[i] * speeds[i] * directions[i * 3] / 100000,
      starts[i * 3 + 1] + elapsed[i] * speeds[i] * directions[i * 3 + 1] / 100000,
      starts[i * 3 + 2] + elapsed[i] * speeds[i] * directions[i * 3 + 2] / 100000
    ])
    m4.rotate(matrix, matrix, rotations[i] * 0.00001 * elapsed[i] % 1000, [0, 0, 1])

    m4.multiply(matrix, matrix, vMatrix)
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, matrix)
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0)
  }
}

ParticleEmitter.randlerp = function (min, max, rnd) {
  if (rnd)
    return Math.round(Math.random() * (max - min) + min)
  else
    return Math.random() * (max - min) + min
}

ParticleEmitter.lerp = function (min, max, factor, rnd) {
  if (rnd)
    return Math.round(factor * (max - min) + min)
  else
    return factor * (max - min) + min
}
