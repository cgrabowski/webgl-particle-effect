function engine (canvas, opts, callback) {

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
  gl.enable(gl.BLEND)
  gl.disable(gl.DEPTH_TEST)
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight)

  var defaultReq = new XMLHttpRequest()
    , defaultOpts
  defaultReq.onload = function () {
    handleRes('default', this.responseText)
    if (opts)
      createEffect(defaultOpts, opts)
  }
  defaultReq.open('get', 'http://localhost/WebGLParticleEffect/default.json')
  defaultReq.send()

  if (!opts) {
    var exampleReq = new XMLHttpRequest()
      , defaultOpts
      , exampleOpts
      , effect

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

  function createEffect (defaultOpts, exampleOpts) {
    effect = new ParticleEffect(gl, new Camera(canvas).viewMatrix, null, null, null, null, render, defaultOpts, exampleOpts)
    callback(effect)
  }

  function render () {
    requestAnimFrame(arguments.callee)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
    effect.render()
  }

  function Camera (canvas, viewMatrix) {

    var sx = 0
      , sy = 0
      , dx = 0
      , dy = 0
      , mouseDown = false
      , self = this

    if (!viewMatrix)
      this.viewMatrix = mat4.create()
    else
      this.viewMatrix = viewMatrix

    this.quaternion = quat.create()
    this.eyeLocVec = vec3.create()
    this.lookVec = vec3.create()
    this.upVec = vec3.create()
    this.crossVec = vec3.create()

    vec3.set(this.eyeLocVec, 0, 0, 15)
    vec3.set(this.lookVec, 0, 0, 0)
    vec3.set(this.upVec, 0, 1, 0)
    vec3.cross(this.crossVec, this.lookVec, this.upVec)

    mat4.lookAt(this.viewMatrix, this.eyeLocVec, this.lookVec, this.upVec)

    canvas.addEventListener('mousedown', function (event) {
      console.log('mousedown', event.x, event.y)
      sx = event.x
      sy = event.y
      mouseDown = true
    }, false)

    document.addEventListener('mousemove', function (event) {
//console.log('mousemove', event.x, event.y)
      if (mouseDown) {
        dx = event.x - sx
        dy = event.y - dy
        if (dx > 0)
          mat4.translate(self.viewMatrix, self.viewMatrix, [0.1, 0, 0])
        else if (dx < 0)
          mat4.translate(self.viewMatrix, self.viewMatrix, [-0.1, 0, 0])

        if (dy > 0)
          mat4.translate(self.viewMatrix, self.viewMatrix, [0, 0.1, 0])
        else if (dy < 0)
          mat4.translate(self.viewMatrix, self.viewMatrix, [0, -0.1, 0])
      }
    }, false)

    document.addEventListener('mouseup', function (event) {
      console.log('mouseup', event)
      mouseDown = false
    }, false)

    window.addEventListener('keypress', function (event) {
      switch (event.charCode) {
        case (119): // w
          mat4.translate(self.viewMatrix, self.viewMatrix, [0, 0.1, 0])
          break
        case (97): // a
          mat4.translate(self.viewMatrix, self.viewMatrix, [-0.1, 0, 0])
          break
        case(115): // s
          mat4.translate(self.viewMatrix, self.viewMatrix, [0, -0.1, 0])
          break
        case(100):  // d
          mat4.translate(self.viewMatrix, self.viewMatrix, [0.1, 0, 0])
          break
      }
    })

    canvas.addEventListener('DOMMouseScroll', function (event) {
      console.log(event)
      if (event.detail > 0)
        mat4.translate(self.viewMatrix, self.viewMatrix, [0, 0, 0.5])
      else if (event.detail < 0)
        mat4.translate(self.viewMatrix, self.viewMatrix, [0, 0, -0.5])
    }, false)

    canvas.addEventListener('mousewheel', function (event) {
      console.log(event)
      if (event.wheelDeltaY > 0)
        mat4.translate(self.viewMatrix, self.viewMatrix, [0, 0, 0.5])
      else if (event.wheelDeltaY < 0)
        mat4.translate(self.viewMatrix, self.viewMatrix, [0, 0, -0.5])
    }, false)
  }
  
  Camera.prototype = {
    constructor: Camera,
    render: function (viewMatrix) {
      
      return viewMatrix
    }
  }
}
