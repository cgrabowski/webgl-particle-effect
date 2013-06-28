function engine (callback) {
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
  gl.enable(gl.BLEND)
  gl.disable(gl.DEPTH_TEST)
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight)

  var defaultReq = new XMLHttpRequest()
  , exampleReq = new XMLHttpRequest()
  , defaultOpts
  , exampleOpts
  , effect

  defaultReq.onload = function () {
handleRes('default', this.responseText)
}
defaultReq.open('get', 'http://localhost/WebGLParticleEffect/default.json')
  exampleReq.onload = function () {
handleRes('example', this.responseText)
}
exampleReq.open('get', 'http://localhost/WebGLParticleEffect/example.json')
  defaultReq.send()
  exampleReq.send()

  function handleRes (name, resText) {
  if (name === 'default')
    defaultOpts = JSON.parse(resText)
    else if (name === 'example')
    exampleOpts = JSON.parse(resText)

    if (defaultOpts && exampleOpts)
    createEffect(defaultOpts, exampleOpts)
  }

function createEffect (defaultOpts, exampleOpts) {
  effect = new ParticleEffect(gl, null, null, 'shader-vs', 'shader-fs', render, defaultOpts, exampleOpts)
  /*
   [{
   textSource: 'igimg/plasma32-1.png',
   maxParticles: 500,
   minDirZ: -1,
   maxDirZ: 1,
   minDelay: 500,
   maxDelay: 5000
   }, {
   textSource: 'igimg/plasma32-2.png',
   maxParticles: 500,
   minDirZ: -1,
   maxDirZ: 1,
   minDelay: 500,
   maxDelay: 5000
   }, {
   textSource: 'igimg/plasma32-3.png',
   maxParticles: 500,
   minDirZ: -1,
   maxDirZ: 1,
   minDelay: 500,
   maxDelay: 5000
   }, {
   textSource: 'igimg/plasma32-12.png',
   maxParticles: 500,
   minDirZ: -1,
   maxDirZ: 1,
   minDelay: 500,
   maxDelay: 5000
   }, {
   textSource: 'igimg/plasma32-22.png',
   maxParticles: 500,
   minDirZ: -1,
   maxDirZ: 1,
   minDelay: 500,
   maxDelay: 5000
   }, {
   textSource: 'igimg/plasma32-32.png',
   maxParticles: 500,
   minDirZ: -1,
   maxDirZ: 1,
   minDelay: 500,
   maxDelay: 5000
   }
   ])
   */
  callback(effect)
}

function render () {
requestAnimFrame(arguments.callee)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
  effect.render()
}
}
