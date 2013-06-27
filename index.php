<!DOCTYPE html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>WebGL Particle Effect</title>
    <script type="text/javascript" src="js/gl-matrix.js"></script>
    <script type="text/javascript" src="js/webgl-utils.js"></script>
    <script id="shader-vs" type="x-shader/x-vertex">
      attribute vec3 aVertexPosition;
      attribute vec2 aTextureCoord;

      uniform mat4 uMVMatrix;
      uniform mat4 uPMatrix;

      varying vec2 vTextureCoord;


      void main(void) {
      gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
      vTextureCoord = aTextureCoord;
      }
    </script>
    <script id="shader-fs" type="x-shader/x-fragment">
      precision mediump float;

      varying vec2 vTextureCoord;

      uniform sampler2D uSampler;

      void main(void) {
      vec4 tmp = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
      gl_FragColor = tmp;
      }
    </script>
    <script src='js/particle-effect.js'></script>
    <script src='js/engine.js'></script>
  </head>
  <body onload="engine();">
    <canvas id="webgl-canvas" style="border: none;" width="500" height="500"></canvas>
  </body>
</html>
