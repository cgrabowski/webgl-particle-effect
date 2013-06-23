webGLStart = function() {
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

  gl.clearColor(0, 0, 0, 1)
  gl.enable(gl.DEPTH_TEST)
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight)

  var pMatrix = mat4.create()
  mat4.identity(pMatrix)
  mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, pMatrix)
  var effect = new ParticleEffect(gl, pMatrix, 'shader-vs', 'shader-fs', callback, [{
      textSource: 'nehe.gif',
      minParticles: 5,
      maxParticles: 100,
      minDirZ: -1,
      maxDirZ: 1,
      minDelay: 500,
      maxDelay: 5000
    }, {
      textSource: 'solar.gif',
      maxParticles: 100,
      minDirZ: -1,
      maxDirZ: 1,
      minDelay: 500,
      maxDelay: 5000
    }])

  function callback() {
    mat4.identity(effect.mvMatrix)
    mat4.translate(effect.mvMatrix, [0.0, -1.0, -5.0])
    console.log(effect)
    render()
  }

  function render() {
    requestAnimFrame(arguments.callee)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    effect.render()
  }
}

