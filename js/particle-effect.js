function ParticleEffect (gl, effectOpts, emittersOpts, callback) {
  if (THREE)
    THREE.Object3D.call(this)
  if (!gl || !gl instanceof WebGLRenderingContext)
    throw new Error('ParticleEffect requires a valid gl context')

  var self = this

  effectOpts = effectOpts || {}

  this.gl = gl
  this.camera = effectOpts.camera || (function () {
    console.error('I need a camera!')
  }())
  this.vShader = effectOpts.vShader || ParticleEffect.defaultVertexShader()
  this.fShader = effectOpts.fShader || ParticleEffect.defaultFragmentShader()
  this.shaderSourceType = effectOpts.shaderSourceType || 'array'
  this.emitters = []
  this.textureSources = []
  this.oldTime = 0
  this.delta = 0
  this.textureManager = ParticleEffect.textureManager(gl)
  this.shaderManager = ParticleEffect.shaderManager(gl)
  this.programHandle = this.shaderManager('createProgram')(this.vShader, this.fShader, this.shaderSourceType)
  this.useProgram = this.shaderManager('useProgram')

  window.addEventListener('unload', function (event) {
    self.textureManager('dispose')()
    self.shaderManager('dispose')()
  })

  /*
   * If emitterOpts are passed to engine, they are used.
   * If not, example opts are loaded from example.json.
   * default.json is allways loaded as a fallback for opts || exampleOpts
   */

  var defaultReq = new XMLHttpRequest()
    , defaultOpts
    , effect
  defaultReq.onload = function () {
    handleRes('default', this.responseText)
    if (emittersOpts)
      createEffect(defaultOpts, emittersOpts)
  }
  defaultReq.open('get', 'http://localhost/WebGLParticleEffect/default.json')
  defaultReq.send()

  if (!emittersOpts) {
    var exampleReq = new XMLHttpRequest()
      , exampleOpts

    exampleReq.onload = function () {
      handleRes('example', this.responseText)
    }
    exampleReq.open('get', 'http://localhost/WebGLParticleEffect/example.json')
    exampleReq.send()
  }

  function handleRes (name, resText) {
    if (name === 'default')
      defaultOpts = JSON.parse(resText)
    else if (name === 'example')
      exampleOpts = JSON.parse(resText)

    if (defaultOpts && exampleOpts)
      createEffect(defaultOpts, exampleOpts)
  }

  function createEffect (defaultOpts, opts) {
    var emittersOpts = []
    for (var i = 0; i < opts.length /*!*/ - 1 /*!*/; i++) {
      emittersOpts[i] = {}
      for (var opt in defaultOpts) {
        emittersOpts[i][opt] = defaultOpts[opt]

        if (opts[i + 1][opt]) {
          emittersOpts[i][opt] = opts[i + 1][opt]
        } else if (opts[0][opt]) {
          emittersOpts[i][opt] = opts[0][opt]
        }
      }
    }
    for (var i = 0; i < emittersOpts.length; i++) {
      self.textureSources[i] = emittersOpts[i].textSource
      self.emitters[i] = new ParticleEmitter(self, emittersOpts[i], i)
    }

    var images = []
      , loaded = 0

    for (var i = 0; i < self.textureSources.length; i++) {
      images[i] = new Image()
      images[i].onload = function () {
        if (++loaded === self.textureSources.length) {
          onImagesLoaded()
        }
      }
      images[i].src = self.textureSources[i]
    }

    function onImagesLoaded () {
      self.textureManager('add')(images)
      for (var i = 0; i < self.emitters.length; i++) {
        self.emitters[i].bindTexture = self.textureManager('bind')(i)
      }
      if (typeof(callback) === 'function')
        callback(self)
    }
  }
}

if (THREE) {
  ParticleEffect.prototype = Object.create(THREE.Object3D.prototype)
  ParticleEffect.prototype.constructor = ParticleEffect
}

ParticleEffect.prototype.render = function () {
  gl.enable(gl.BLEND)
  gl.disable(gl.DEPTH_TEST)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
  gl.disable(gl.CULL_FACE)

  this.useProgram(this.programHandle)

  if (!this.oldTime)
    this.oldTime = new Date().getTime()
  var newTime = new Date().getTime()
  this.delta = newTime - this.oldTime
  this.oldTime = newTime

  var ln = this.emitters.length
  for (var i = 0; i < ln; i++)
    this.emitters[i].render(this.delta)
}

ParticleEffect.prototype.init = function () {
}

ParticleEffect.shaderManager = function (gl) {
  var programs = []
    , vertexShaders = []
    , fragmentShaders = []
    , activeProgramHandle

  return function (method) {
    switch (method) {

      case ('createProgram'):
        return function (vertex, fragment, sourceType) {
          var fragmentShader
            , vertexShader
            , prog = gl.createProgram()

          sourceType = sourceType.toLowerCase()
          if (sourceType === 'html') {
            vertexShader = getShaderFromHTML(gl, vertex)
            fragmentShader = getShaderFromHTML(gl, fragment)
          } else if (sourceType === 'string') {
            vertexShader = getshaderFromString(gl, vertex, 'vertex')
            fragmentShader = getShaderFromString(gl, fragment, 'fragment')
          } else if (sourceType === 'array') {
            vertexShader = getShaderFromArray(gl, vertex, 'vertex')
            fragmentShader = getShaderFromArray(gl, fragment, 'fragment')
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
          prog.mvpProjectionMatrixUniform = gl.getUniformLocation(prog, "uMVPMatrix")
          prog.samplerUniform = gl.getUniformLocation(prog, "uSampler")
          programs.push(prog)
          vertexShaders.push(vertexShader)
          fragmentShaders.push(fragmentShader)
          return programs.length - 1
        }

      case ('useProgram'):
        return function (index) {
          gl.useProgram(programs[index])
          activeProgramHandle = index
          return programs[index]
        }

      case ('getShaderVariable'):
        return function (string) {
          return programs[activeProgramHandle][string]
        }

      case ('dispose'):
        return function () {
          for (var i = 0; i < programs.length; i++) {
            gl.deleteProgram(programs[i])
          }
          vertexShaders = fragmentShaders = programs = null
        }

      default:
        throw new Error('shaderManager\'s argument must be a method name: createProgram or dispose')
    }
  }

  function getShaderFromHTML (gl, id) {
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
    return getShaderFromString(str, type)
  }

  function getShaderFromArray (gl, array, type) {
    var str = array.join('')
    return getShaderFromString(str, type)
  }

  function getShaderFromString (str, type) {
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
  }
}

ParticleEffect.defaultVertexShader = function () {
  var vArray = []
  vArray[0] = 'attribute vec3 aVertexPosition;'
  vArray[1] = 'attribute vec2 aTextureCoord;'
  vArray[2] = 'uniform mat4 uMVPMatrix;'
  vArray[3] = 'varying vec2 vTextureCoord;'
  vArray[4] = 'void main(void) {'
  vArray[5] = 'gl_Position = uMVPMatrix * vec4(aVertexPosition, 1.0);'
  vArray[6] = 'vTextureCoord = aTextureCoord;'
  vArray[7] = '}'
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

ParticleEffect.textureManager = function (gl) {
  var textures = []

  if (!gl || !gl instanceof WebGLRenderingContext)
    throw new Error('invalid gl instance')

  return function (method) {
    switch (method) {

      case ('add'):
        return function (images) {
          if (!typeof(images) === 'array') {
            textures.push(createTexture(images))
            return textures.length - 1
          } else {
            var firstHandle = textures.length
            for (var i = 0; i < images.length; i++) {
              textures.push(createTexture(images[i]))
            }
            return firstHandle
          }
        }

      case ('bind'):
        return function (index) {
          return function () {
            gl.bindTexture(gl.TEXTURE_2D, textures[index])
          }
        }

      case ('remove'):
        return function (index) {
          gl.deleteTexture(textures[index])
          textures.splice(index, 1)
        }

      case ('replace'):
        return function (image, index) {
          var oldTexture = textures[index]
          textures[index] = createTexture(image)
          gl.deleteTexture(oldTexture)
          return textures[index]
        }

      case ('dispose'):
        return function () {
          for (var i = 0; i < textures.length; i++) {
            gl.deleteTexture(textures[i])
          }
          textures = null
        }

      default:
        throw new Error('textureManager\'s argument must be a method name: init, add, get, remove, replace, or dispose')
    }
  }

  function createTexture (image) {
    var texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.bindTexture(gl.TEXTURE_2D, null)
    return texture
  }
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

  this._matrix = mat4.create()
  this.mMatrix = effect.matrix.elements
  this.vMatrix = effect.camera.matrixWorld.elements
  this.pMatrix = effect.camera.projectionMatrix.elements
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

}

ParticleEmitter.prototype.render = function (delta) {
  var effect = this.effect
    , gl = effect.gl
    , numParticles = this.maxParticles
    , text = this.texture
    , getShaderVar = effect.shaderManager('getShaderVariable')
    , mvpProjectionMatrixUniform = getShaderVar('mvpProjectionMatrixUniform')
    , vertexPositionAttribute = getShaderVar('vertexPositionAttribute')
    , textureCoordAttribute = getShaderVar('textureCoorAttribute')
    , samplerUniform = getShaderVar('samplerUniform')

    , _matrix = this._matrix
    , mMatrix = this.mMatrix
    , vMatrix = this.vMatrix
    , pMatrix = this.pMatrix

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
  gl.vertexAttribPointer(vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0)
  gl.bindBuffer(gl.ARRAY_BUFFER, this.textCoordBuff)
  gl.vertexAttribPointer(textureCoordAttribute, 2, gl.FLOAT, false, 0, 0)
  gl.uniform1i(samplerUniform, 0)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuff)
  this.bindTexture()

  for (i = 0; i < numParticles; i++) {
    // if elapsed is negative, the particle is delayed
    if (elapsed[i] < 0)
      continue
    //m4.copy(matrix, mMatrix)
    m4.translate(_matrix, mMatrix, [
      starts[i * 3] + elapsed[i] * speeds[i] * directions[i * 3] / 100000,
      starts[i * 3 + 1] + elapsed[i] * speeds[i] * directions[i * 3 + 1] / 100000,
      starts[i * 3 + 2] + elapsed[i] * speeds[i] * directions[i * 3 + 2] / 100000
    ])
    m4.rotate(_matrix, _matrix, rotations[i] * 0.00001 * elapsed[i] % 1000, [0, 0, 1])

    m4.multiply(_matrix, vMatrix, _matrix)
    m4.multiply(_matrix, pMatrix, _matrix)
    gl.uniformMatrix4fv(mvpProjectionMatrixUniform, false, _matrix)
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0)
  }
}

ParticleEmitter.prototype.initBuffers = function () {
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
