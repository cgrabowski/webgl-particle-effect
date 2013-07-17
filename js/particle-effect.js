function ParticleEffect (gl, effectOpts, emittersOpts, callback) {
    if (THREE) {
        THREE.Object3D.call(this);
    }
    if (!gl || !gl instanceof WebGLRenderingContext) {
        throw new Error('ParticleEffect requires a valid gl context');
    }

    var self = this,
        effectOpts = effectOpts || {};

    this.gl = gl;
    this.camera = effectOpts.camera || console.error('I need a camera!');
    this.vShader = effectOpts.vShader || ParticleEffect.defaultVertexShader();
    this.fShader = effectOpts.fShader || ParticleEffect.defaultFragmentShader();
    this.shaderSourceType = effectOpts.shaderSourceType || 'array';
    this.graphablesConfig = effectOpts.graphablesConfig || 0;
    this.channelConfig = effectOpts.channelConfig || 0;
    this.emitters = [];
    this.textureSources = [];
    this.oldTime = 0;
    this.delta = 0;
    this.textureManager = ParticleEffect.textureManager(gl);
    this.shaderManager = ParticleEffect.shaderManager(gl);
    this.programHandle = this.shaderManager('createProgram')(this.vShader, this.fShader, this.shaderSourceType);
    this.useProgram = this.shaderManager('useProgram');

    window.addEventListener('unload', function (event) {
        self.textureManager('dispose')();
        self.shaderManager('dispose')();
    });

    var defaultEmittersOpts = [{
            emitterName: "default",
            textSource: "particle.png",
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
            minDirectionXTest: [0, -1, null, null, 1, 1, 2, -1],
            maxDirectionXTest: [0, -1, null, null, 1, 1, 2, -1],
            //
            minDirectionY: 1,
            maxDirectionY: 1,
            //
            minDirectionZ: 0,
            maxDirectionZ: 0,
            //
            minRotation: 180,
            maxRotation: 540
        }, {
            "emitterName": "emitter 0",
            "textSource": "igimg/plasma32-1.png"
        }, {
            "emitterName": "emitter 1",
            "textSource": "igimg/plasma32-2.png"
        }, {
            "emitterName": "emitter 2",
            "textSource": "igimg/plasma32-3.png"
        }, {
            "emitterName": "emitter 3",
            "textSource": "igimg/plasma32-12.png"
        }];

    if (emittersOpts) {
        for (var i = 1; i < emittersOpts.length; i++) {
            for (var opt in defaultEmittersOpts[i]) {
                emittersOpts[i][opt] = emittersOpts[i][opt] ||
                    emittersOpts[0][opt] ||
                    defaultEmittersOpts[i][opt] ||
                    defaultEmittersOpts[0][opt];
            }
        }

        emittersOpts.splice(0, 1);

    } else {
        emittersOpts = defaultEmittersOpts;
        for (var opt in emittersOpts[0]) {
            for (var i = 1; i < emittersOpts.length; i++) {
                emittersOpts[i][opt] = emittersOpts[i][opt] ||
                    emittersOpts[0][opt];
            }
        }

        emittersOpts.splice(0, 1);

    }

    for (var i = 0; i < emittersOpts.length; i++) {
        self.textureSources[i] = emittersOpts[i].textSource;
        self.emitters[i] = new ParticleEmitter(self, emittersOpts[i], i);
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
        images[i].src = self.textureSources[i];
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


if (THREE) {
    ParticleEffect.prototype = Object.create(THREE.Object3D.prototype);
    ParticleEffect.prototype.constructor = ParticleEffect;
}

ParticleEffect.prototype.render = function () {
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

ParticleEffect.prototype.init = function () {
};

ParticleEffect.GRAPHABLES = ['offsetX', 'offsetY', 'offsetZ', 'speed', 'directionX', 'directionY', 'directionZ', 'rotation'];

ParticleEffect.BASE_GRAPH_ARRAY = [0, -1, null, null, 1, 1, 2, -1];


ParticleEffect.GRAPHABLE_FLAGS = {
    OFFSETX_BIT: 1,
    OFFSETY_BIT: 2,
    OFFSETZ_BIT: 4,
    SPEED_BIT: 8,
    DIRECTIONX_BIT: 16,
    DIRECTIONY_BIT: 32,
    DIRECTIONZ_BIT: 64,
    ROTATION_BIT: 128
};

ParticleEffect.prototype.enableGraphed = function (bitmask) {
    this.graphablesConfig |= bitmask;
};

ParticleEffect.prototype.disableGraphed = function (bitmask) {
    this.graphablesConfig = ~(~this.graphablesConfig | bitmask);
};

ParticleEffect.prototype.getEnabledGraphed = function () {
    var arr = [],
        i = 0;

    for (var flag in ParticleEffect.GRAPHABLE_FLAGS) {
        if (ParticleEffect.GRAPHABLE_FLAGS[flag] & this.graphablesConfig) {
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

ParticleEffect.CHANNEL_FLAGS = {
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

ParticleEffect.prototype.useOwnChannel = function (bitmask) {
    this.channelConfig |= bitmask;
};

ParticleEffect.prototype.useMasterChannel = function (bitmask) {
    this.channelConfig = ~(~this.channelConfig | bitmask);
};

ParticleEffect.prototype.getUsingOwnChannel = function () {
    var arr = [],
        i = 0;

    for (var flag in ParticleEffect.GRAPHABLE_FLAGS) {
        if (ParticleEffect.GRAPHABLE_FLAGS[flag] & this.channelConfig) {
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

ParticleEffect.shaderManager = function (gl) {
    var programs = [],
        vertexShaders = [],
        fragmentShaders = [],
        activeProgramHandle;

    return function (method) {
        switch (method) {

            case ('createProgram'):
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

            case ('useProgram'):
                return function (index) {
                    gl.useProgram(programs[index]);
                    activeProgramHandle = index;
                    return programs[index];
                };

            case ('getShaderVariable'):
                return function (string) {
                    return programs[activeProgramHandle][string];
                };

            case ('dispose'):
                return function () {
                    for (var i = 0; i < programs.length; i++) {
                        gl.deleteProgram(programs[i]);
                    }
                    vertexShaders = fragmentShaders = programs = null;
                };

            default:
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

ParticleEffect.defaultVertexShader = function () {
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

ParticleEffect.defaultFragmentShader = function () {
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

ParticleEffect.textureManager = function (gl) {
    var textures = [];

    if (!gl || !gl instanceof WebGLRenderingContext) {
        throw new Error('invalid gl instance');
    }

    return function (method) {
        switch (method) {

            case ('add'):
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
            case ('bind'):
                return function (index) {
                    return function () {
                        gl.bindTexture(gl.TEXTURE_2D, textures[index]);
                    };
                };
            case ('remove'):
                return function (index) {
                    gl.deleteTexture(textures[index]);
                    textures.splice(index, 1);
                };
            case ('replace'):
                return function (image, index) {
                    var oldTexture = textures[index];
                    textures[index] = createTexture(image);
                    gl.deleteTexture(oldTexture);
                    return textures[index];
                };
            case ('dispose'):
                return function () {
                    for (var i = 0; i < textures.length; i++) {
                        ;
                        gl.deleteTexture(textures[i]);
                    }
                    textures = null;
                };
            default:
                throw new Error('textureManager\'s argument must be a method name: init, add, get, remove, replace, or dispose');
        }
    };

    function createTexture (image) {
        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return texture;
    }

};
