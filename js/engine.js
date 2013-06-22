(function() {

  var gl
    , shaderProgram
    , texture
    , mvMatrix = mat4.create()
    , mvMatrixStack = []
    , pMatrix = mat4.create()
    , vertBuff
    , textCoordBuff
    , indexBuff
    , timeNow
    , elapsed
    , xRot = 0
    , yRot = 0
    , zRot = 0
    , lastTime = 0
    , geo = new Rect()

  webGLStart = function () {
    var canvas = document.getElementById('webgl-canvas')
    try {
      gl = canvas.getContext('experimental-webgl')
      gl.viewportWidth = canvas.width
      gl.viewportHeight = canvas.height
    } catch (e) {
      console.log(e.message)
    }
    if (!gl)
      throw new Error('Could not initialize WebGL :-O')
    initShaders()
    initBuffers()
    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.enable(gl.DEPTH_TEST)
    // pass render as a callback to textureFactory to ensure the textures are loaded before rendering
    textureFactory(['solar.gif', 'nehe.gif'], render)
  }

  function initShaders() {
    var fragmentShader = getShader(gl, "shader-fs")
    var vertexShader = getShader(gl, "shader-vs")

    shaderProgram = gl.createProgram()
    gl.attachShader(shaderProgram, vertexShader)
    gl.attachShader(shaderProgram, fragmentShader)
    gl.linkProgram(shaderProgram)

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS))
      alert("Could not initialise shaders")

    gl.useProgram(shaderProgram)
    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition")
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute)
    shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord")
    gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute)
    shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix")
    shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix")
    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler")
  }

  function getShader(gl, id) {
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
      alert(gl.getShaderInfoLog(shader))
      return null
    }

    return shader
  }

  function initBuffers() {
    vertBuff = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vertBuff)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.vertices), gl.STATIC_DRAW)

    textCoordBuff = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, textCoordBuff)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.textCoords), gl.STATIC_DRAW)

    indexBuff = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuff)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geo.indices), gl.STATIC_DRAW)
  }

  function textureFactory(sources, onload) {
    if (typeof(sources) === 'string')
      sources = [sources]

    textureFactory.textures = []
    var numLoaded = 0

    for (var i = 0; i < sources.length; i++) {
      textureFactory.textures[i] = initTexture(sources[i], function() {
        if (++numLoaded === sources.length)
          onload()
      })
    }
  }

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

  function render() {
    requestAnimFrame(render)

    var textures = textureFactory.textures
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, pMatrix)
    mat4.identity(mvMatrix)
    mat4.translate(mvMatrix, [0.0, 0.0, -5.0])
    mat4.rotate(mvMatrix, degToRad(xRot), [1, 0, 0])
    mat4.rotate(mvMatrix, degToRad(yRot), [0, 1, 0])
    mat4.rotate(mvMatrix, degToRad(zRot), [0, 0, 1])

    gl.bindBuffer(gl.ARRAY_BUFFER, vertBuff)
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, geo.vertSize, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, textCoordBuff)
    gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, geo.textCoordSize, gl.FLOAT, false, 0, 0)
    gl.uniform1i(shaderProgram.samplerUniform, 0)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuff)
    gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix)
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, textures[0])
    gl.drawElements(gl.TRIANGLES, geo.indexNum, gl.UNSIGNED_SHORT, 0)

    mat4.rotate(mvMatrix, degToRad(90), [1, 0, 0])
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix)
    gl.bindTexture(gl.TEXTURE_2D, textures[1])
    gl.drawElements(gl.TRIANGLES, geo.indexNum, gl.UNSIGNED_SHORT, 0)

    timeNow = new Date().getTime()
    if (lastTime !== 0) {
      elapsed = timeNow - lastTime
      xRot += (90 * elapsed) / 1000.0
      yRot += (90 * elapsed) / 1000.0
      zRot += (90 * elapsed) / 1000.0
    }
    lastTime = timeNow
  }

  function mvPushMatrix() {
    var copy = mat4.create()
    mat4.set(mvMatrix, copy)
    mvMatrixStack.push(copy)
  }

  function mvPopMatrix() {
    if (mvMatrixStack.length === 0) {
      throw "Invalid popMatrix!"
    }
    mvMatrix = mvMatrixStack.pop()
  }

  function degToRad(degrees) {
    return degrees * Math.PI / 180
  }

}())