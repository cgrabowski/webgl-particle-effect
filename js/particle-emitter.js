ParticleEmitter = (function (window, undefined) {

    return function (effect, opts, index) {

        var rp = ParticleEmitter.randlerp;

        this.opts = opts || {};

        this.emitterName = this.opts.emitterName = opts.emitterName || (index) ? 'emitter ' + index : 'emitter ' + effect.emitters.length;

        var graphableRegex = new RegExp(/^(min|max)(?=(Offset[X-Z]|Direction[X-Z]|Speed|Rotation)$)/),
            limits = ParticleEffect.OPTS_LIMITS;

        for (var opt in ParticleEffect.DEFAULT_OPTS) {
            if (!this.opts[opt]) {
                this.opts[opt] = ParticleEffect.DEFAULT_OPTS[opt];

            }
            if (!this.opts.hasOwnProperty(opt + 'Graph') && graphableRegex.test(opt)) {
                this.opts[opt + 'Graph'] = ParticleEffect.BASE_GRAPH_ARRAY.slice();
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

        this.effect = effect || null;
        this.opts.graphablesConfig = opts.graphablesConfig || 0;
        this.opts.channelConfig = opts.channelConfig || 0;
        this._matrix = mat4.create();
        this.mMatrix = effect.matrix.elements;
        this.vMatrix = effect.camera.matrixWorld.elements;
        this.pMatrix = effect.camera.projectionMatrix.elements;
        this.lives = [];
        this.lifeElapsed = [];
        this.offsets = [];
        this.directions = [];
        this.speeds = [];
        this.rotations = [];
        this.randoms = [];
        this.vertices = [-0.1, -0.1, 0.1, 0.1, -0.1, 0.1, 0.1, 0.1, 0.1, -0.1, 0.1, 0.1];
        this.textCoords = [0, 0, 1, 0, 1, 1, 0, 1];
        this.indices = [0, 1, 2, 0, 2, 3];
        for (i = 0; i < opts.numParticles; i++) {
            this.lives.push(rp(opts.minLife, opts.maxLife, true));
            this.lifeElapsed.push(-rp(opts.minDelay, opts.maxDelay, true));
            this.offsets.push(
                rp(opts.minOffsetX, opts.maxOffsetX),
                rp(opts.minOffsetY, opts.maxOffsetY),
                rp(opts.minOffsetZ, opts.maxOffsetZ));
            this.directions.push(
                rp(opts.minDirectionX, opts.maxDirectionX),
                rp(opts.minDirectionY, opts.maxDirectionY),
                rp(opts.minDirectionZ, opts.maxDirectionZ));
            this.speeds.push(rp(opts.minSpeed, opts.maxSpeed));
            this.rotations.push(rp(opts.minRotation, opts.maxRotation));
            this.randoms.push(Math.random());
        }
        this.vertId = opts.vertId || null;
        this.fragId = opts.fragId || null;
        if (opts.vertId && opts.fragId) {
            this.createShaderProgram(effect.gl, opts.VertId, opts.FragId);
        } else {
            this.shaderProgram = effect.shaderProgram;
            this.initBuffers();
        }
    }
}(window));

ParticleEmitter.prototype = Object.create(ParticleEffect.prototype);
ParticleEmitter.prototype.constructor = ParticleEmitter;

ParticleEmitter.prototype.render = function (delta) {
    var effect = this.effect,
        effectOpts = effect.opts,
        gl = effect.gl,
        getShaderVar = this.getShaderManager()('getShaderVariable'),
        mvpProjectionMatrixUniform = getShaderVar('mvpProjectionMatrixUniform'),
        vertexPositionAttribute = getShaderVar('vertexPositionAttribute'),
        textureCoordAttribute = getShaderVar('textureCoordAttribute'),
        samplerUniform = getShaderVar('samplerUniform'),
        _matrix = this._matrix,
        mMatrix = this.mMatrix,
        vMatrix = this.vMatrix,
        pMatrix = this.pMatrix,
        opts = this.opts,
        gConfig = this.opts.graphablesConfig,
        cConfig = this.opts.channelConfig,
        egConfig = effectOpts.graphablesConfig || 0,
        gFlags = ParticleEffect.GRAPHABLE_FLAGS,
        cFlags = ParticleEffect.CHANNEL_FLAGS,
        lives = this.lives,
        elapsed = this.lifeElapsed,
        offsets = this.offsets,
        speeds = this.speeds,
        directions = this.directions,
        rotations = this.rotations,
        randoms = this.randoms,
        m4 = mat4,
        math = Math,
        //
        numParticles = (cFlags['NUMPARTICLES_BIT'] & this.channelConfig) ? opts.numParticles : effectOpts.numParticles,
        //
        minLife = (cFlags['LIFE_BIT'] & cConfig) ? opts.minLife : effectOpts.minLife,
        //
        maxLife = (cFlags['LIFE_BIT'] & cConfig) ? opts.maxLife : effectOpts.maxLife,
        //
        minDelay = (cFlags['DELAY_BIT'] & cConfig) ? opts.minDelay : effectOpts.minDelay,
        //
        maxDelay = (cFlags['DELAY_BIT'] & cConfig) ? opts.maxDelay : effectOpts.maxDelay,
        //
        minDirectionX = (cFlags['DIRECTIONX_BIT'] & cConfig) ? opts.minDirectionX : effectOpts.minDirectionX,
        //   
        maxDirectionX = (cFlags['DIRECTIONX_BIT'] & cConfig) ? opts.maxDirectionX : effectOpts.maxDirectionX,
        //
        minDirectionY = (cFlags['DIRECTIONY_BIT'] & cConfig) ? opts.minDirectionY : effectOpts.minDirectionY,
        //
        maxDirectionY = (cFlags['DIRECTIONY_BIT'] & cConfig) ? opts.maxDirectionY : effectOpts.maxDirectionY,
        //
        minDirectionZ = (cFlags['DIRECTIONZ_BIT'] & cConfig) ? opts.minDirectionZ : effectOpts.minDirectionZ,
        //
        maxDirectionZ = (cFlags['DIRECTIONZ_BIT'] & cConfig) ? opts.maxDirectionZ : effectOpts.maxDirectionZ,
        //
        minOffsetX = (cFlags['OFFSETX_BIT'] & cConfig) ? opts.minOffsetX : effectOpts.minOffsetX,
        //
        maxOffsetX = (cFlags['OFFSETX_BIT'] & cConfig) ? opts.maxOffsetX : effectOpts.maxOffsetX,
        //
        minOffsetY = (cFlags['OFFSETY_BIT'] & cConfig) ? opts.minOffsetY : effectOpts.minOffsetY,
        //
        maxOffsetY = (cFlags['OFFSETY_BIT'] & cConfig) ? opts.maxOffsetY : effectOpts.maxOffsetY,
        //
        minOffsetZ = (cFlags['OFFSETZ_BIT'] & cConfig) ? opts.minOffsetZ : effectOpts.minOffsetZ,
        //
        maxOffsetZ = (cFlags['OFFSETZ_BIT'] & cConfig) ? opts.maxOffsetZ : effectOpts.maxOffsetZ,
        //
        minSpeed = (cFlags['SPEED_BIT'] & cConfig) ? opts.minSpeed : effectOpts.minSpeed,
        //
        maxSpeed = (cFlags['SPEED_BIT'] & cConfig) ? opts.maxSpeed : effectOpts.maxSpeed,
        //
        minRotation = (cFlags['ROTATION_BIT']) & cConfig ? opts.minRotation : effectOpts.minRotation,
        //
        maxRotation = (cFlags['ROTATION_BIT']) & cConfig ? opts.maxRotation : effectOpts.maxRotation;
    // If grap flag is set, use graph data.
    // If channel flag is set, use emitter data.
    if (cConfig & cFlags.DIRECTIONX_BIT && gConfig & gFlags.DIRECTIONX_BIT) {
        var minDirectionXGraph = opts.minDirectionXGraph,
            maxDirectionXGraph = opts.maxDirectionXGraph;
    } else if (egConfig & gFlags.DIRECTIONX_BIT) {
        var minDirectionXGraph = effectOpts.minDirectionXGraph,
            maxDirectionXGraph = effectOpts.maxDirectionXGraph;
    }

    if (cConfig & cFlags.DIRECTIONY_BIT && gConfig & gFlags.DIRECTIONY_BIT) {
        var minDirectionYGraph = opts.minDirectionYGraph,
            maxDirectionYGraph = opts.maxDirectionYGraph;
    } else if (egConfig & gFlags.DIRECTIONY_BIT) {
        var minDirectionYGraph = effectOpts.minDirectionYGraph,
            maxDirectionYGraph = effectOpts.maxDirectionYGraph;
    }

    if (cConfig & cFlags.DIRECTIONZ_BIT && gConfig & gFlags.DIRECTIONZ_BIT) {
        var minDirectionZGraph = opts.minDirectionZGraph,
            maxDirectionZGraph = opts.maxDirectionZGraph;
    } else if (egConfig & gFlags.DIRECTIONZ_BIT) {
        var minDirectionZGraph = effectOpts.minDirectionZGraph,
            maxDirectionZGraph = effectOpts.maxDirectionZGraph;
    }

    if (cConfig & cFlags.OFFSETX_BIT && gConfig & gFlags.OFFSETX_BIT) {
        var minOffsetXGraph = opts.minOffsetXGraph,
            maxOffsetXGraph = opts.maxOffsetXGraph;
    } else if (egConfig & gFlags.OFFSETX_BIT) {
        var minOffsetXGraph = effectOpts.minOffsetXGraph,
            maxOffsetXGraph = effectOpts.maxOffsetXGraph;
    }

    if (cConfig & cFlags.OFFSETY_BIT && gConfig & gFlags.OFFSETY_BIT) {
        var minOffsetYGraph = opts.minOffsetYGraph,
            maxOffsetYGraph = opts.maxOffsetYGraph;
    } else if (egConfig & gFlags.OFFSETY_BIT) {
        var minOffsetYGraph = effectOpts.minOffsetYGraph,
            maxOffsetYGraph = effectOpts.maxOffsetYGraph;
    }

    if (cConfig & cFlags.OFFSETZ_BIT && gConfig & gFlags.OFFSETZ_BIT) {
        var minOffsetZGraph = opts.minOffsetZGraph,
            maxOffsetZGraph = opts.maxOffsetZGraph;
    } else if (egConfig & gFlags.OFFSETZ_BIT) {
        var minOffsetZGraph = effectOpts.minOffsetZGraph,
            maxOffsetZGraph = effectOpts.maxOffsetZGraph;
    }

    if (cConfig & cFlags.SPEED_BIT && gConfig & gFlags.SPEED_BIT) {
        var minSpeedGraph = opts.minSpeedGraph,
            maxSpeedGraph = opts.maxSpeedGraph;
    } else if (egConfig & gFlags.SPEED_BIT) {
        var minSpeedGraph = effectOpts.minSpeedGraph,
            maxSpeedGraph = effectOpts.maxSpeedGraph;
    }

    if (cConfig & cFlags.ROTATION_BIT && gConfig & gFlags.ROTATION_BIT) {
        var minRotationGraph = opts.minRotationGraph,
            maxRotationGraph = opts.maxRotationGraph;
    } else if (egConfig & gFlags.ROTATION_BIT) {
        var minRotationGraph = effectOpts.minRotationGraph,
            maxRotationGraph = effectOpts.maxRotationGraph;
    }


    //resurect dead particles with fresh randomized props;
    for (var i = 0; i < numParticles; i++) {
        // particle gets older;
        elapsed[i] += delta;
        // if particle's life is elapsed, it needs resurected;
        if (elapsed[i] > lives[i]) {
            // new lifespan;
            lives[i] = math.random() * (maxLife - minLife) + minLife;
            // new start point;
            offsets.splice(i * 3, 3,
                math.random() * (maxOffsetX - minOffsetX) + minOffsetX,
                math.random() * (maxOffsetY - minOffsetY) + minOffsetY,
                math.random() * (maxOffsetZ - minOffsetZ) + minOffsetZ);
            // reset elapsed (negative elapsed creates delay);
            elapsed[i] = -(math.random() * (maxDelay - minDelay) + minDelay);
            // determine a new directional vector;
            directions.splice(i * 3, 3,
                math.random() * (maxDirectionX - minDirectionX) + minDirectionX,
                math.random() * (maxDirectionY - minDirectionY) + minDirectionY,
                math.random() * (maxDirectionZ - minDirectionZ) + minDirectionZ);

            speeds[i] = math.random() * (maxSpeed - minSpeed) + minSpeed;
            rotations[i] = math.random() * (maxRotation - minRotation) + minRotation;
            randoms[i] = math.random();
        }

        //[x1, y1, minLimit, maxLimit, x2, y2, m(1, 2), b(1, 2), x3, y3, m(2, 3), b(2, 3)[, ...]]

        // direction X
        if (minDirectionXGraph) {
            var min,
                max,
                k = 0,
                range = minDirectionXGraph[3] - minDirectionXGraph[2];

            // find the minline line segment at the current life value
            while (elapsed[i] / lives[i] > minDirectionXGraph[k + 4]) {
                k += 4;
            }

            // minline y-axis value for the line segment -- [k + 6] is the slope, [k + 7] is the y-intercept
            min = range * minDirectionXGraph[k + 6] * (elapsed[i] / lives[i]) + minDirectionXGraph[k + 7];

            // find the maxline line segment at the current life value
            k = 0;
            while (elapsed[i] / lives[i] > maxDirectionXGraph[k + 4]) {
                k += 4;
            }

            // maxline y-axis value for the line segment -- [k + 6] is the slope, [k + 7] is the y-intercept
            max = range * maxDirectionXGraph[k + 6] * (elapsed[i] / lives[i]) + maxDirectionXGraph[k + 7];
            // check for valid number
            if (!isNaN(max) && !isNaN(min)) {
                directions[i * 3] = randoms[i] * (max - min) + min;
            }
        }

        // direction Y
        if (minDirectionYGraph) {
            var min,
                max,
                k = 0,
                range = minDirectionYGraph[3] - minDirectionYGraph[2];

            while (elapsed[i] / lives[i] > minDirectionYGraph[k + 4]) {
                k += 4;
            }
            min = range * minDirectionYGraph[k + 6] * (elapsed[i] / lives[i]) + minDirectionYGraph[k + 7];
            k = 0;
            while (elapsed[i] / lives[i] > maxDirectionYGraph[k + 4]) {
                k += 4;
            }
            max = range * maxDirectionYGraph[k + 6] * (elapsed[i] / lives[i]) + maxDirectionYGraph[k + 7];
            if (!isNaN(max) && !isNaN(min)) {
                directions[i * 3 + 1] = randoms[i] * (max - min) + min;
            }
        }

        // direction Z
        if (minDirectionZGraph) {
            var min,
                max,
                k = 0,
                range = minDirectionZGraph[3] - minDirectionZGraph[2];

            while (elapsed[i] / lives[i] > minDirectionZGraph[k + 4]) {
                k += 4;
            }
            min = range * minDirectionZGraph[k + 6] * (elapsed[i] / lives[i]) + minDirectionZGraph[k + 7];
            k = 0;
            while (elapsed[i] / lives[i] > maxDirectionZGraph[k + 4]) {
                k += 4;
            }
            max = range * maxDirectionZGraph[k + 6] * (elapsed[i] / lives[i]) + maxDirectionZGraph[k + 7];
            if (!isNaN(max) && !isNaN(min)) {
                directions[i * 3 + 2] = randoms[i] * (max - min) + min;
            }
        }


        // offset X
        if (minOffsetXGraph) {
            var min,
                max,
                k = 0,
                range = minOffsetXGraph[3] - minOffsetXGraph[2];

            while (elapsed[i] / lives[i] > minOffsetXGraph[k + 4]) {
                k += 4;
            }
            min = range * ((minOffsetXGraph[k + 6] * (elapsed[i] / lives[i]) + minOffsetXGraph[k + 7]) + 1) * 0.5 * (minOffsetXGraph[2] - minOffsetXGraph[3]);
            k = 0;
            while (elapsed[i] / lives[i] > maxOffsetXGraph[k + 4]) {
                k += 4;
            }
            max = range * ((maxOffsetXGraph[k + 6] * (elapsed[i] / lives[i]) + minOffsetXGraph[k + 7]) + 1) * 0.5 * (maxOffsetXGraph[2] - maxOffsetXGraph[3]);
            if (!isNaN(max) && !isNaN(min)) {

                offsets[i * 3] = randoms[i] * (max - min) + min;
            }
        }

        // offset Y
        if (minOffsetYGraph) {
            var min,
                max,
                k = 0,
                range = minOffsetYGraph[3] - minOffsetYGraph[2];

            while (elapsed[i] / lives[i] > minOffsetYGraph[k + 4]) {
                k += 4;
            }
            min = range * minOffsetYGraph[k + 6] * (elapsed[i] / lives[i]) + minOffsetYGraph[k + 7];
            k = 0;
            while (elapsed[i] / lives[i] > maxOffsetYGraph[k + 4]) {
                k += 4;
            }
            max = range * maxOffsetYGraph[k + 6] * (elapsed[i] / lives[i]) + maxOffsetYGraph[k + 7];
            if (!isNaN(max) && !isNaN(min)) {
                offsets[i * 3 + 1] = randoms[i] * (max - min) + min;
            }
        }

        // offset Z
        if (minOffsetZGraph) {
            var min,
                max,
                k = 0,
                range = minOffsetZGraph[3] - minOffsetZGraph[2];

            while (elapsed[i] / lives[i] > minOffsetZGraph[k + 4]) {
                k += 4;
            }
            min = range * minOffsetZGraph[k + 6] * (elapsed[i] / lives[i]) + minOffsetZGraph[k + 7];
            k = 0;
            while (elapsed[i] / lives[i] > maxOffsetZGraph[k + 4]) {
                k += 4;
            }
            max = range * maxOffsetZGraph[k + 6] * (elapsed[i] / lives[i]) + maxOffsetZGraph[k + 7];
            if (!isNaN(max) && !isNaN(min)) {
                offsets[i * 3 + 2] = randoms[i] * (max - min) + min;
            }
        }

        // speed
        if (minSpeedGraph) {
            var min,
                max,
                k = 0,
                range = minSpeedGraph[3] - minSpeedGraph[2];

            while (elapsed[i] / lives[i] > minSpeedGraph[k + 4]) {
                k += 4;
            }
            min = range * minSpeedGraph[k + 6] * (elapsed[i] / lives[i]) + minSpeedGraph[k + 7];
            k = 0;
            while (elapsed[i] / lives[i] > maxSpeedGraph[k + 4]) {
                k += 4;
            }
            max = range * maxSpeedGraph[k + 6] * (elapsed[i] / lives[i]) + maxSpeedGraph[k + 7];
            if (!isNaN(max) && !isNaN(min)) {
                speeds[i * 3] = randoms[i] * (max - min) + min;
            }
        }

        // rotation
        if (minRotationGraph) {
            var min,
                max,
                k = 0,
                range = minRotationGraph[3] - minRotationGraph[2];

            while (elapsed[i] / lives[i] > minRotationGraph[k + 4]) {
                k += 4;
            }
            min = range * minRotationGraph[k + 6] * (elapsed[i] / lives[i]) + minRotationGraph[k + 7];
            k = 0;
            while (elapsed[i] / lives[i] > maxRotationGraph[k + 4]) {
                k += 4;
            }
            max = range * maxRotationGraph[k + 6] * (elapsed[i] / lives[i]) + maxRotationGraph[k + 7];
            if (!isNaN(max) && !isNaN(min)) {
                rotations[i * 3] = randoms[i] * (max - min) + min;
            }
        }

    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertBuff);
    gl.vertexAttribPointer(vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.textCoordBuff);
    gl.vertexAttribPointer(textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1i(samplerUniform, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuff);
    this.bindTexture();

    for (i = 0; i < numParticles; i++) {
        // if elapsed is negative, the particle is delayed;
        if (elapsed[i] < 0) {
            continue;
        }
        //m4.copy(matrix, mMatrix);
        m4.translate(_matrix, mMatrix, [
            offsets[i * 3] + elapsed[i] * speeds[i] * directions[i * 3] / 100000,
            offsets[i * 3 + 1] + elapsed[i] * speeds[i] * directions[i * 3 + 1] / 100000,
            offsets[i * 3 + 2] + elapsed[i] * speeds[i] * directions[i * 3 + 2] / 100000
        ]);

        m4.rotate(_matrix, _matrix, rotations[i] * 0.00001 * elapsed[i] % 1000, [0, 0, 1]);
        m4.multiply(_matrix, vMatrix, _matrix);
        m4.multiply(_matrix, pMatrix, _matrix);
        gl.uniformMatrix4fv(mvpProjectionMatrixUniform, false, _matrix);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }
};

ParticleEmitter.prototype.initBuffers = function () {
    this.vertBuff = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertBuff);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.vertices), gl.STATIC_DRAW);
    this.textCoordBuff = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.textCoordBuff);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.textCoords), gl.STATIC_DRAW);
    this.indexBuff = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuff);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.indices), gl.STATIC_DRAW);
};

ParticleEmitter.randlerp = function (min, max, rnd) {
    if (rnd) {
        return Math.round(Math.random() * (max - min) + min);
    } else {
        return Math.random() * (max - min) + min;
    }
};

ParticleEmitter.lerp = function (min, max, factor, rnd) {
    if (rnd) {
        return Math.round(factor * (max - min) + min);
    } else {
        return factor * (max - min) + min;
    }
};

ParticleEmitter.srandlerp = function (min, max, rnd) {
    if (rnd) {
        return Math.round(Math.random() * (max - min) + min);
    } else {
        return Math.sqrt(Math.random()) * (max - min) + min;
    }
};
