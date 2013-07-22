function engine (canvas, effectOpts, emittersOpts, engineCallback) {

    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = window.innerWidth;
        canvas.height = canvas.width / 16 * 9;
        document.body.appendChild(canvas);
    }

    try {
        gl = WebGLUtils.setupWebGL(canvas);
    } catch (e) {
        console.error(e.message);
    }

    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);

    var scene = new THREE.Scene(),
        camera = new THREE.PerspectiveCamera(60, gl.viewportWidth / gl.viewportHeight, 1, 1000.0),
        renderer = new THREE.WebGLRenderer({canvas: canvas}),
    controls = new THREE.TrackballControls(camera, canvas);

    effectOpts = effectOpts || {};
    effectOpts.camera = camera;

    effect = new ParticleEffect(gl, effectOpts, emittersOpts, effectCallback);

    controls.rotateSpeed = 1.0;
    controls.zoomSpeed = 10;
    controls.panSpeed = 0.8;
    controls.noZoom = false;
    controls.noPan = false;
    controls.staticMoving = true;
    controls.dynamicDampingFactor = 0;
    controls.target.set(0, 0, -10);

    function resize (event) {
        canvas.width = window.innerWidth;
        canvas.height = canvas.width / 16 * 9;
        gl.viewPortWidth = canvas.width;
        gl.viewportHeight = canvas.height;
        gl.viewport(0, 0, gl.viewPortWidth, gl.viewportHeight);
        controls.handleResize();
    }
    resize();
    window.addEventListener('resize', resize, false);

    // reset camera
    window.addEventListener('keydown', function (event) {
        if (event.keyCode === 82) { // R key
            controls.target.set(0, 0, -10);
            controls._eye.set(0, 0, 10);
            camera.position.set(0, 0, 0);
            camera.up.set(0, 1, 0);
            camera.matrix.identity();
            camera.matrixWorld.identity();
        }
    }, false);

    function effectCallback () {
        scene.add(effect);
        renderer.addPostPlugin(effect);
        render();
        if (engineCallback) {
            engineCallback(gl, effect, render);
        } else {
            render();
        }
    }

    var rendering = true;
    function render () {
        if (rendering) {
            requestAnimFrame(render);
            renderer.render(scene, camera);
            controls.update();
        }
    }

    window.addEventListener('pause', function (event) {
        rendering = false;
    }, false);
    window.addEventListener('resume', function (event) {
        rendering = true;
        render();
    }, false);
}
