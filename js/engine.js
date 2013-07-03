function engine (canvas, emittersOpts, engineCallback) {
  try {
    gl = canvas.getContext('experimental-webgl')
    gl.viewportWidth = canvas.width
    gl.viewportHeight = canvas.height
  } catch (e) {
    console.error(e.message)
  }
  if (!gl)
    throw new Error('Could not initialize WebGL :-O')

  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight)

  var scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(60, gl.viewportWidth / gl.viewportHeight, 1, 1000.0)
  var renderer = new THREE.WebGLRenderer({canvas: canvas})
    , effect = new ParticleEffect(gl, {camera: camera}, null, effectCallback)
  controls = new THREE.TrackballControls(camera)

  controls.rotateSpeed = 1.0
  controls.zoomSpeed = 10
  controls.panSpeed = 0.8
  controls.noZoom = false
  controls.noPan = false
  controls.staticMoving = true
  controls.dynamicDampingFactor = 0
  controls.target.set(0, 0, -10)

  // reset camera
  window.addEventListener('keydown', function (event) {
    if (event.keyCode === 82) { // R key     
      controls.target.set(0, 0, -10)
      controls._eye.set(0, 0, 10)
      camera.position.set(0, 0, 0)
      camera.up.set(0, 1, 0)
      camera.matrix.identity()
      camera.matrixWorld.identity()
    }
  }, false)

  function effectCallback () {
    scene.add(effect)
    renderer.addPostPlugin(effect)
    engineCallback(effect, render)
  }

  function render () {
    requestAnimFrame(render)
    renderer.render(scene, camera)
    controls.update()
  }

}

