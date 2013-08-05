var PEE = PEE || {};

PEE.ParticleEffect = (function (window, undefined) {

    return function (gl, effectOpts, emittersOpts, callback) {

        if (!gl || !gl instanceof WebGLRenderingContext) {
            throw new Error('PEE.ParticleEffect requires a valid gl context');
        }

        if (THREE) {
            THREE.Object3D.call(this);
        }

        var self = this;
        this.gl = gl;
        this.opts = effectOpts = effectOpts || {};
        this.camera = effectOpts.camera || console.error('I need a camera!');
        this.vShader = effectOpts.vShader || PEE.ParticleEffect.defaultVertexShader();
        this.fShader = effectOpts.fShader || PEE.ParticleEffect.defaultFragmentShader();
        this.shaderSourceType = effectOpts.shaderSourceType || 'array';
        this.opts.graphablesConfig = effectOpts.graphablesConfig || 0;
        this.emitters = [];
        this.textureSources = [];
        this.oldTime = 0;
        this.delta = 0;
        this.textureManager = this.getTextureManager(gl);
        this.shaderManager = this.getShaderManager(gl);
        this.programHandle = this.shaderManager('createProgram')(this.vShader, this.fShader, this.shaderSourceType);
        this.useProgram = this.shaderManager('useProgram');

        var graphableRegex = new RegExp(/^(min|max)(?=(Offset[X-Z]|Direction[X-Z]|Speed|Rotation)$)/),
            limits = PEE.ParticleEffect.OPTS_LIMITS;

        for (var opt in PEE.ParticleEffect.DEFAULT_OPTS) {
            if (!this.opts.hasOwnProperty(opt)) {
                this.opts[opt] = PEE.ParticleEffect.DEFAULT_OPTS[opt];
            }

            if (!this.opts.hasOwnProperty(opt + "Graph") && graphableRegex.test(opt)) {
                this.opts[opt + "Graph"] = PEE.ParticleEffect.BASE_GRAPH_ARRAY.slice();
                // cut off the 'min' or 'max' and then
                // change the first char to lower case
                this.opts[opt + "Graph"][2] = limits[opt.substr(3, 1).toLowerCase() + opt.substr(4)][0];
                this.opts[opt + "Graph"][3] = limits[opt.substr(3, 1).toLowerCase() + opt.substr(4)][1];
            }
        }

        // non-graphable opts
        if (!this.opts.hasOwnProperty("numParticlesLimits")) {
            this.opts.numParticlesLimits = limits.numParticles;
        }
        if (!this.opts.hasOwnProperty("lifeLimits")) {
            this.opts.lifeLimits = limits.life;
        }
        if (!this.opts.hasOwnProperty("delayLimits")) {
            this.opts.delayLimits = limits.delay;
        }

        window.addEventListener('unload', function (event) {
            self.textureManager('dispose')();
            self.shaderManager('dispose')();
        });

        var defaultOpts = PEE.ParticleEffect.DEFAULT_OPTS;

        if (emittersOpts) {
            for (var i = 0; i < emittersOpts.length; i++) {
                for (var opt in defaultOpts) {
                    emittersOpts[i][opt] = emittersOpts[i][opt] || defaultOpts[opt];
                }
                emittersOpts[i].textSource = emittersOpts[i].textSource || PEE.ParticleEffect.DEFAULT_TEXTURES[i];
            }

        } else {
            emittersOpts = [];
            for (var i = 0; i < 4; i++) {
                emittersOpts[i] = {};
                for (var opt in defaultOpts) {
                    emittersOpts[i][opt] = defaultOpts[opt];
                    emittersOpts[i].textSource = PEE.ParticleEffect.DEFAULT_TEXTURES[i];
                }
            }
        }

        for (var i = 0; i < emittersOpts.length; i++) {
            self.textureSources[i] = emittersOpts[i].textSource;
            self.emitters[i] = new PEE.ParticleEmitter(self, emittersOpts[i], i);
        }
        var images = [],
            loaded = 0;

        for (var i = 0; i < self.textureSources.length; i++) {
            images[i] = new Image();
            images[i].onload = function () {
                if (++loaded === self.textureSources.length) {
                    onImagesLoaded();
                }
            }

            try {
                images[i].src = self.textureSources[i];

            } catch (e) {
                console.error(e.message);
            }
        }

        function onImagesLoaded () {
            self.textureManager('add')(images);
            for (var i = 0; i < self.emitters.length; i++) {
                self.emitters[i].bindTexture = self.textureManager('bind')(i);
            }
            if (typeof(callback) === 'function') {
                callback(self);
            }
        }
    }

}(window));

if (THREE) {
    PEE.ParticleEffect.prototype = Object.create(THREE.Object3D.prototype);
    PEE.ParticleEffect.prototype.constructor = PEE.ParticleEffect;
}

PEE.ParticleEffect.prototype.render = function () {

    gl.enable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.disable(gl.CULL_FACE);
    this.useProgram(this.programHandle);
    if (!this.oldTime) {
        this.oldTime = new Date().getTime();
    }
    var newTime = new Date().getTime();
    this.delta = newTime - this.oldTime;
    this.oldTime = newTime;
    var ln = this.emitters.length;
    for (var i = 0; i < ln; i++) {
        this.emitters[i].render(this.delta);
    }
};

// neccessary for a three.js plugin
PEE.ParticleEffect.prototype.init = function () {
};

PEE.ParticleEffect.DEFAULT_OPTS = {
    textSource: "images/particle.png",
    numParticles: 200,
    //
    minLife: 4000,
    maxLife: 6000,
    //
    minDelay: 0,
    maxDelay: 500,
    //
    minOffsetX: -2,
    maxOffsetX: 2,
    //
    minOffsetY: -1,
    maxOffsetY: 1,
    //
    minOffsetZ: -10,
    maxOffsetZ: -9,
    //
    minSpeed: 100,
    maxSpeed: 500,
    //
    minDirectionX: 0,
    maxDirectionX: 0,
    //
    minDirectionY: 1,
    maxDirectionY: 1,
    //
    minDirectionZ: 0,
    maxDirectionZ: 0,
    //
    minRotation: 180,
    maxRotation: 540
};

PEE.ParticleEffect.DEFAULT_TEXTURES = ['igimg/plasma32-1.png', 'igimg/plasma32-2.png', 'igimg/plasma32-3.png', 'igimg/plasma32-12.png'];

PEE.ParticleEffect.GRAPHABLES = ['offsetX', 'offsetY', 'offsetZ', 'speed', 'directionX', 'directionY', 'directionZ', 'rotation'];

PEE.ParticleEffect.BASE_GRAPH_ARRAY = [0, -1, null, null, 1, 1, 2, -1];

PEE.ParticleEffect.OPTS_LIMITS = {
    numParticles: [1, 300],
    life: [1, 10000],
    delay: [0, 10000],
    //
    offsetX: [-10, 10],
    offsetY: [-10, 10],
    offsetZ: [-15, -5],
    //
    speed: [1, 1000],
    //
    directionX: [-1, 1],
    directionY: [-1, 1],
    directionZ: [-1, 1],
    //
    rotation: [-7200, 7200]
};

PEE.ParticleEffect.GRAPHABLE_FLAGS = {
    OFFSETX_BIT: 1,
    OFFSETY_BIT: 2,
    OFFSETZ_BIT: 4,
    //
    SPEED_BIT: 8,
    //
    DIRECTIONX_BIT: 16,
    DIRECTIONY_BIT: 32,
    DIRECTIONZ_BIT: 64,
    //
    ROTATION_BIT: 128
};

// regex to test for properly named graphable:
// /^(min|max)(?=(Offset[X-Z]|Direction[X-Z]|Speed|Rotation)$)/
PEE.ParticleEffect.prototype.enableGraphed = function (bitmask) {
    this.opts.graphablesConfig |= bitmask;

};

PEE.ParticleEffect.prototype.disableGraphed = function (bitmask) {
    this.opts.graphablesConfig = ~(~this.graphablesConfig | bitmask);

};

PEE.ParticleEffect.prototype.getEnabledGraphed = function () {

    var arr = [],
        i = 0;

    for (var flag in PEE.ParticleEffect.GRAPHABLE_FLAGS) {
        if (PEE.ParticleEffect.GRAPHABLE_FLAGS[flag] & this.opts.graphablesConfig) {
            var str = flag.toLowerCase().substr(0, flag.length - 4);
            if (str.match(/[xyz]$/)) {
                str = str.substr(0, str.length - 1) + str.substr(-1).toUpperCase();
            }
            arr.push(flag.toLowerCase().substr(0, flag.length - 4));
        }
        i++;
    }
    return arr;
};

PEE.ParticleEffect.CHANNEL_FLAGS = {
    NUMPARTICLES_BIT: 1,
    LIFE_BIT: 2,
    DELAY_BIT: 4,
    OFFSETX_BIT: 8,
    OFFSETY_BIT: 16,
    OFFSETZ_BIT: 32,
    SPEED_BIT: 64,
    DIRECTIONX_BIT: 128,
    DIRECTIONY_BIT: 256,
    DIRECTIONZ_BIT: 512,
    ROTATION_BIT: 1024
};

PEE.ParticleEffect.prototype.useOwnChannel = function (bitmask) {

    this.opts.channelConfig |= bitmask;
};

PEE.ParticleEffect.prototype.useMasterChannel = function (bitmask) {

    this.opts.channelConfig = ~(~this.channelConfig | bitmask);
};

PEE.ParticleEffect.prototype.getUsingOwnChannel = function () {

    var arr = [],
        i = 0;

    for (var flag in PEE.ParticleEffect.GRAPHABLE_FLAGS) {
        if (PEE.ParticleEffect.GRAPHABLE_FLAGS[flag] & this.opts.channelConfig) {
            var str = flag.toLowerCase().substr(0, flag.length - 4);
            if (str.match(/[xyz]$/)) {
                str = str.substr(0, str.length - 1) + str.substr(-1).toUpperCase();
            }
            arr.push(flag.toLowerCase().substr(0, flag.length - 4));
        }
        i++;
    }

    return arr;
};

(function /*ShaderManager*/ () {
    var _gl,
        programs = [],
        vertexShaders = [],
        fragmentShaders = [],
        activeProgramHandle;

    PEE.ParticleEffect.prototype.getShaderManager = function (gl) {

        if (!_gl) {
            _gl = gl || console.error('You must pass a gl instance to ShaderManager the first time you use it.');
        }

        return function (method) {

            if (method === 'createProgram') {
                return function (vertex, fragment, sourceType) {
                    var fragmentShader,
                        vertexShader,
                        prog = gl.createProgram();
                    sourceType = sourceType.toLowerCase();
                    if (sourceType === 'html') {
                        vertexShader = getShaderFromHTML(gl, vertex);
                        fragmentShader = getShaderFromHTML(gl, fragment);
                    } else if (sourceType === 'string') {
                        vertexShader = getshaderFromString(gl, vertex, 'vertex');
                        fragmentShader = getShaderFromString(gl, fragment, 'fragment');
                    } else if (sourceType === 'array') {
                        vertexShader = getShaderFromArray(gl, vertex, 'vertex');
                        fragmentShader = getShaderFromArray(gl, fragment, 'fragment');
                    } else {
                        throw new Error('sourceType parameter must be "html", "string", or "array"');
                    }

                    gl.attachShader(prog, vertexShader);
                    gl.attachShader(prog, fragmentShader);
                    gl.linkProgram(prog);
                    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
                        throw new Error("Could not initialize shaders");
                    }
                    gl.useProgram(prog);
                    prog.vertexPositionAttribute = gl.getAttribLocation(prog, "aVertexPosition");
                    gl.enableVertexAttribArray(prog.vertexPositionAttribute);
                    prog.textureCoordAttribute = gl.getAttribLocation(prog, "aTextureCoord");
                    gl.enableVertexAttribArray(prog.textureCoordAttribute);
                    prog.mvpProjectionMatrixUniform = gl.getUniformLocation(prog, "uMVPMatrix");
                    prog.samplerUniform = gl.getUniformLocation(prog, "uSampler");
                    programs.push(prog);
                    vertexShaders.push(vertexShader);
                    fragmentShaders.push(fragmentShader);
                    return programs.length - 1;
                };

            } else if (method === 'useProgram') {
                return function (index) {
                    gl.useProgram(programs[index]);
                    activeProgramHandle = index;
                    return programs[index];
                };

            } else if (method === 'getShaderVariable') {
                return function (string) {
                    return programs[activeProgramHandle][string];
                };

            } else if (method === 'dispose') {
                return function () {
                    for (var i = 0; i < programs.length; i++) {
                        gl.deleteProgram(programs[i]);
                    }
                    vertexShaders = fragmentShaders = programs = null;
                };

            } else {
                throw new Error('shaderManager\'s argument must be a method name: createProgram or dispose');
            }
        };

        function getShaderFromHTML (gl, id) {

            var str = "",
                shaderScript = document.getElementById(id),
                shader,
                type;

            if (!shaderScript) {
                return null;
            }

            var k = shaderScript.firstChild;
            while (k) {
                if (k.nodeType === 3)
                    ;
                str += k.textContent;
                k = k.nextSibling;
            }

            if (shaderScript.type === "x-shader/x-vertex") {
                type = 'vertex';
            } else if (shaderScript.type === "x-shader/x-fragment") {
                type = 'fragment';
            } else {
                throw new Error('Shader MIME type must be "x-shader/x-vertex" or "x-shader/x-fragment"');
                return null;
            }

            return getShaderFromString(str, type);
        }

        function getShaderFromArray (gl, array, type) {

            var str = array.join('');
            return getShaderFromString(str, type);
        }

        function getShaderFromString (str, type) {

            var shader;
            if (type === 'vertex') {
                shader = gl.createShader(gl.VERTEX_SHADER);
            } else if (type === 'fragment') {
                shader = gl.createShader(gl.FRAGMENT_SHADER);
            } else {
                throw new Error('shader type parameter must be "vertex" or "fragment"');
                return null;
            }
            gl.shaderSource(shader, str);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                throw new Error('Error compiling ' + type + ' shader');
                return null;
            }
            return shader;
        }

    };
}());

PEE.ParticleEffect.defaultVertexShader = function () {

    var vArray = [];
    vArray[0] = 'attribute vec3 aVertexPosition;';
    vArray[1] = 'attribute vec2 aTextureCoord;';
    vArray[2] = 'uniform mat4 uMVPMatrix;';
    vArray[3] = 'varying vec2 vTextureCoord;';
    vArray[4] = 'void main(void) {';
    vArray[5] = 'gl_Position = uMVPMatrix * vec4(aVertexPosition, 1.0);';
    vArray[6] = 'vTextureCoord = aTextureCoord;';
    vArray[7] = '}';
    return vArray;
};

PEE.ParticleEffect.defaultFragmentShader = function () {

    var fArray = [];
    fArray[0] = 'precision mediump float;';
    fArray[1] = 'varying vec2 vTextureCoord;';
    fArray[2] = 'uniform sampler2D uSampler;';
    fArray[3] = 'void main(void) {';
    fArray[4] = 'vec4 tmp = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));';
    fArray[5] = 'gl_FragColor = tmp;';
    fArray[6] = '}';
    return fArray;
};

(function /*TextureManager*/ () {
    var _gl,
        textures = [];

    PEE.ParticleEffect.prototype.getTextureManager = function (gl) {

        if (!_gl) {
            _gl = gl || console.error('You must pass a gl instance to TextureManager the first time you use it.');
        }

        return function (method) {
            if (method === 'add') {
                return function (images) {
                    if (!typeof(images) === 'array') {
                        textures.push(createTexture(images));
                        return textures.length - 1;
                    } else {
                        var firstHandle = textures.length;
                        for (var i = 0; i < images.length; i++) {
                            textures.push(createTexture(images[i]));
                        }
                        return firstHandle;
                    }
                };
            } else if (method === 'bind') {
                return function (index) {
                    return function () {
                        _gl.bindTexture(_gl.TEXTURE_2D, textures[index]);
                    };
                };
            } else if (method === 'remove') {
                return function (index) {
                    _gl.deleteTexture(textures[index]);
                    textures.splice(index, 1);
                };
            } else if (method === 'replace') {
                return function (image, index) {
                    var oldTexture = textures[index];
                    textures[index] = createTexture(image);
                    _gl.deleteTexture(oldTexture);
                    return textures[index];
                };
            } else if (method === 'dispose') {
                return function () {
                    for (var i = 0; i < textures.length; i++) {
                        ;
                        _gl.deleteTexture(textures[i]);
                    }
                    textures = null;
                };
            } else {
                throw new Error('textureManager\'s argument must be a method name: init, add, get, remove, replace, or dispose');
            }
        };

        function createTexture (image) {

            var texture = _gl.createTexture();
            _gl.bindTexture(_gl.TEXTURE_2D, texture);
            _gl.pixelStorei(_gl.UNPACK_FLIP_Y_WEBGL, true);
            _gl.texImage2D(_gl.TEXTURE_2D, 0, _gl.RGBA, _gl.RGBA, _gl.UNSIGNED_BYTE, image);
            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MAG_FILTER, _gl.NEAREST);
            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MIN_FILTER, _gl.NEAREST);
            _gl.bindTexture(_gl.TEXTURE_2D, null);
            return texture;
        }
    };
}());

