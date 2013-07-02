function engine (canvas, emittersOpts, engineCallback) {

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
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight)

  var effect = new ParticleEffect(gl, null, emittersOpts, effectCallback)

  function effectCallback () {
    engineCallback(effect)
    render()
  }

  function render () {
    requestAnimFrame(arguments.callee)
    gl.clear(gl.COLOR_BUFFER_BIT)

    effect.render()
  }

}

