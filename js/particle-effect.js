function ParticleEffect(gl, pMatrix, vertId, fragId, callback, emittersOpts) {
  if (arguments.length === 0)
    return
  if (!gl || !gl instanceof WebGLRenderingContext)
    throw new Error('ParticleEffect requires a valid gl context')

  var textFac = ParticleEffect.textureFactory

  this.gl = gl
  this.pMatrix = pMatrix
  this.mvMatrix = mat4.create()
  this.emitters = []
  this.textureSources = []
  this.oldTime = new Date().getTime()
  this.delta = 0

  this.createShaderProgram(gl, vertId, fragId)

  if (!emittersOpts instanceof Array)
    emitterOpts = [emittersOpts]

  for (var i = 0; i < emittersOpts.length; i++) {
    this.textureSources[i] = emittersOpts[i].textSource || 'particle.png'
    this.emitters[i] = new ParticleEmitter(this, emittersOpts[i])
  }

  textFac(this.textureSources, assignTextures)

  var self = this
  function assignTextures() {
    for (i = 0; i < textFac.textures.length; i++)
      self.emitters[i].texture = textFac.textures[i]
    callback()
  }
}

ParticleEffect.prototype = {
  constructor: ParticleEffect,
  render: function() {
    var newTime = new Date().getTime()
    this.delta = newTime - this.oldTime
    this.oldTime = newTime
    var ln = this.emitters.length
    for (var i = 0; i < ln; i++)
      this.emitters[i].render(this.delta)
  },
  getShader: function(gl, id) {
    var str = ""
            , shaderScript = document.getElementById(id)
            , shader

    if (!shaderScript)
      return null

    var k = shaderScript.firstChild
    while (k) {
      if (k.nodeType === 3)
        str += k.textContent
      k = k.nextSibling
    }

    if (shaderScript.type === "x-shader/x-fragment")
      shader = gl.createShader(gl.FRAGMENT_SHADER)
    else if (shaderScript.type === "x-shader/x-vertex")
      shader = gl.createShader(gl.VERTEX_SHADER)
    else
      return null

    gl.shaderSource(shader, str)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.log(gl.getShaderInfoLog(shader))
      return null
    }
    return shader
  },
  createShaderProgram: function(gl, vertId, fragId) {
    var fragmentShader = this.getShader(gl, fragId)
            , vertexShader = this.getShader(gl, vertId)
            , prog = this.shaderProgram = gl.createProgram()

    gl.attachShader(prog, vertexShader)
    gl.attachShader(prog, fragmentShader)
    gl.linkProgram(prog)

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
      throw new Error("Could not initialise shaders")

    gl.useProgram(prog)
    prog.vertexPositionAttribute = gl.getAttribLocation(prog, "aVertexPosition")
    gl.enableVertexAttribArray(prog.vertexPositionAttribute)
    prog.textureCoordAttribute = gl.getAttribLocation(prog, "aTextureCoord")
    gl.enableVertexAttribArray(prog.textureCoordAttribute)
    prog.pMatrixUniform = gl.getUniformLocation(prog, "uPMatrix")
    prog.mvMatrixUniform = gl.getUniformLocation(prog, "uMVMatrix")
    prog.samplerUniform = gl.getUniformLocation(prog, "uSampler")
  },
  initBuffers: function() {
    this.vertBuff = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertBuff)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.vertices), gl.STATIC_DRAW)

    this.textCoordBuff = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.textCoordBuff)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.textCoords), gl.STATIC_DRAW)

    this.indexBuff = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuff)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.indices), gl.STATIC_DRAW)
  }
}


ParticleEffect.textureFactory = function(sources, onload) {
  if (typeof(sources) === 'string')
    sources = [sources]

  var numLoaded = 0

  for (var i = 0; i < sources.length; i++) {
    ParticleEffect.textureFactory.textures[i] = initTexture(sources[i], function() {
      if (++numLoaded === sources.length)
        onload()
    })
  }
}

ParticleEffect.textureFactory.textures = []

function initTexture(src, callback) {
  var texture = gl.createTexture()
  texture.image = new Image()
  texture.image.onload = function() {
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.bindTexture(gl.TEXTURE_2D, null)
    if (callback)
      callback()
  }
  texture.image.src = src
  return texture
}

function ParticleEmitter(effect, opts) {
  var rp = ParticleEmitter.randlerp

  this.effect = effect || null
  this.minParticles = opts.minParticles || 0
  this.maxParticles = opts.maxParticles || 20
  this.minLife = opts.minLife || 3000
  this.maxLife = opts.maxLife || 10000
  this.duration = opts.duration || 10000
  this.coninuous = opts.continuous || true
  this.minDelay = opts.minDelay || 0
  this.maxDelay = opts.maxDelay || 0
  this.xOffsetMin = opts.xOffsetMin || -1
  this.yOffsetMin = opts.yOffsetMin || 0
  this.zOffsetMin = opts.zOffsetMin || 0
  this.xOffsetMax = opts.xOffsetMax || 1
  this.yOffsetMax = opts.yOffsetMax || 0
  this.zOffsetMax = opts.zOffsetMax || 0
  this.minSpeed = opts.minSpeed || 0.0001
  this.maxSpeed = opts.maxSpeed || 0.001
  this.minDirX = opts.minDirX || -0.25
  this.maxDirX = opts.maxDirX || 0.25
  this.minDirY = opts.minDirY || 1
  this.maxDirY = opts.maxDirY || 1
  this.minDirZ = opts.minDirZ || 0
  this.maxDirZ = opts.maxDirZ || 0
  this.wind = opts.wind || [0, 0, 0]
  this.minRot = opts.minRot || 720
  this.MaxRot = opts.maxRot || 720
  this.minRotVec = opts.minRotVec || [0, 0, 1]
  this.maxRotVec = opts.maxRotVec || [0, 0, 1]
  this.rotAcc = 0

  this.matrix = mat4.create()
  this.lives = []
  this.lifeElapsed = []
  this.directions = []
  this.speeds = []
  this.vertices = []
  this.textCoords = []
  this.indices = []
  for (i = 0; i < this.maxParticles; i++) {
    this.lives.push(rp(this.minLife, this.maxLife, true))
    this.lifeElapsed.push(-rp(this.minDelay, this.maxDelay, true))
    this.directions.push(rp(this.minDirX, this.maxDirX), rp(this.minDirY, this.maxDirY), rp(this.minDirZ, this.maxDirZ))
    this.speeds.push(rp(this.minSpeed, this.maxSpeed))
    var xSet = rp(this.xOffsetMin, this.xOffsetMax)
            , ySet = rp(this.yOffsetMin, this.yOffsetMax)
            , zSet = rp(this.zOffsetMin, this.zOffsetMax)
    this.vertices.push(
            -0.1 + xSet, -0.1 + ySet, 0.1 + zSet
            , 0.1 + xSet, -0.1 + ySet, 0.1 + zSet
            , 0.1 + xSet, 0.1 + ySet, 0.1 + zSet
            , -0.1 + xSet, 0.1 + ySet, 0.1 + zSet
            )
    this.textCoords.push(0, 0, 1, 0, 1, 1, 0, 1)
    this.indices.push(0 + (i * 4), 1 + (i * 4), 2 + (i * 4), 0 + (i * 4), 2 + (i * 4), 3 + (i * 4))
  }

  this.vertId = opts.vertId || null
  this.fragId = opts.fragId || null
  if (opts.vertId && opts.fragId)
    this.createShaderProgram(effect.gl, opts.VertId, opts.FragId)
  else
    this.shaderProgram = effect.shaderProgram

  this.initBuffers()
}

ParticleEmitter.prototype = new ParticleEffect
ParticleEmitter.prototype.constructor = ParticleEmitter

ParticleEmitter.prototype.render = function(delta) {
  var gl = this.effect.gl
          , numParticles = this.maxParticles
          , text = this.texture
          , pMatrix = this.effect.pMatrix
          , shaderProgram = (this.shaderProgram || effect.shaderProgram)
          , minLife = this.minLife
          , maxLife = this.maxLife
          , minDelay = this.minDelay
          , maxDelay = this.maxDelay
          , lives = this.lives
          , elapsed = this.lifeElapsed
          , lifeLen = this.lives.length
          , speeds = this.speeds
          , directions = this.directions
          , effectMat = this.effect.mvMatrix
          , matrix = this.matrix
          , rp = ParticleEmitter.randlerp
          , m4 = mat4

  //resurect dead particles with fresh randomized props
  for (var i = 0; i < lifeLen; i++) {
    // particle gets older
    elapsed[i] += delta
    // if particle's life is elapsed, it needs resurected
    if (elapsed[i] > lives[i]) {
      // vertices hold starting point data
      var verts = this.vertices
              , xSet = rp(this.xOffsetMin, this.xOffsetMax)
              , ySet = rp(this.yOffsetMin, this.yOffsetMax)
              , zSet = rp(this.zOffsetMin, this.zOffsetMax)
      verts.splice(i * 12, 12, -0.1 + xSet, -0.1 + ySet, 0.1 + zSet, 0.1 + xSet, -0.1 + ySet, 0.1 + zSet, 0.1 + xSet, 0.1 + ySet, 0.1 + zSet, -0.1 + xSet, 0.1 + ySet, 0.1 + zSet)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vertBuff)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW)
      // new lifespan
      lives[i] = rp(minLife, maxLife, true)
      // reset elapsed (negative elapsed creates delay)
      elapsed[i] = (-rp(minDelay, maxDelay))
      // determine a new directional vector
      directions.splice(i * 3, 3, rp(this.minDirX, this.maxDirX), rp(this.minDirY, this.maxDirY), rp(this.minDirZ, this.maxDirZ))
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
    m4.multiply(matrix, matrix, effectMat)
    m4.translate(matrix, matrix, [
      elapsed[i] * speeds[i] * directions[i * 3],
      elapsed[i] * speeds[i] * directions[i * 3 + 1],
      elapsed[i] * speeds[i] * directions[i * 3 + 2]
    ])
    
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, matrix)
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, i * 6 * 2)
  }
}

ParticleEmitter.randlerp = function(min, max, rnd) {
  if (rnd)
    return Math.round(Math.random() * (max - min) + min)
  else
    return Math.random() * (max - min) + min
}

ParticleEmitter.lerp = function(min, max, factor, rnd) {
  if (rnd)
    return Math.round(factor * (max - min) + min)
  else
    return factor * (max - min) + min
}

