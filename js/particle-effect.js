
function ParticleEffect(gl, emittersOpts) {
  if (!gl || !gl instanceof WebGLRenderingContext)
    throw new Error('ParticleEffect requires a valid gl context')
  Rect.call(this)
  this.emitters = []
  for (var i = 0; i < emitterOpts.length; i++) {
    this.emitters[i] = new ParticleEmitter(emittersOpts[i])
  }
}

function ParticleEmitter(opts) {

}

function Rect() {
  this.vertSize = 3
  this.vertNum = 4
  this.vertices = [
    -1.0, -1.0, 1.0,
    1.0, -1.0, 1.0,
    1.0, 1.0, 1.0,
    -1.0, 1.0, 1.0
  ]
  this.textCoordSize = 2
  this.textCoordNum = 4
  this.textCoords = [
    0.0, 0.0,
    1.0, 0.0,
    1.0, 1.0,
    0.0, 1.0
  ]
  this.indexSize = 1
  this.indexNum = 6
  this.indices = [
    0, 1, 2, 0, 2, 3
  ]
}

(function() {
  var fn = ParticleEffect.prototype
  fn.render = function() {
  }

}())