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
            if (!this.opts[opt + 'Graph'] && graphableRegex.test(opt)) {
                this.opts[opt + 'Graph'] = ParticleEffect.BASE_GRAPH_ARRAY.slice();
                this.opts[opt + 'Graph']
                    .splice(2, 0,
                    // cut off the 'min' or 'max' and then
                    // change the first char to lower case
                    limits[opt.substr(3, 1).toLowerCase() + opt.substr(4)][0],
                    limits[opt.substr(3, 1).toLowerCase() + opt.substr(4)][1]
                    );

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
        this.starts = [];
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
            this.starts.push(rp(opts.minOffsetX, opts.maxOffsetX), rp(opts.minOffsetY, opts.maxOffsetY), rp(opts.minOffsetZ, opts.maxOffsetZ));
            this.directions.push(rp(opts.minDirectionX, opts.maxDirectionX), rp(opts.minDirectionY, this.maxDirectionY), rp(opts.minDirectionZ, opts.maxDirectionZ));
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
        effectOpts = (effect.opts) ? effect.opts : {},
        gl = effect.gl,
        text = this.texture,
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
        //
        gConfig = this.graphablesConfig,
        cConfig = this.channelConfig,
        egConfig = effectOpts.graphablesConfig || 0,
        gFlags = ParticleEffect.GRAPHABLE_FLAGS,
        cFlags = ParticleEffect.CHANNEL_FLAGS,
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
        minOffsetX = (cFlags['OFFSETX_BIT'] & cConfig) ? opts.maxDirectionZ : effectOpts.maxDirectionZ,
        //
        maxOffsetX = (cFlags['OFFSETX_BIT'] & cConfig) ? opts.maxDirectionZ : effectOpts.maxDirectionZ,
        //
        minOffsetY = (cFlags['OFFSETY_BIT'] & cConfig) ? opts.maxDirectionZ : effectOpts.maxDirectionZ,
        //
        maxOffsetY = (cFlags['OFFSETY_BIT'] & cConfig) ? opts.maxDirectionZ : effectOpts.maxDirectionZ,
        //
        minOffsetZ = (cFlags['OFFSETZ_BIT'] & cConfig) ? opts.maxDirectionZ : effectOpts.maxDirectionZ,
        //
        maxOffsetZ = (cFlags['OFFSETZ_BIT'] & cConfig) ? opts.maxDirectionZ : effectOpts.maxDirectionZ,
        //
        lives = this.lives,
        elapsed = this.lifeElapsed,
        lifeLen = this.lives.length,
        starts = this.starts,
        speeds = this.speeds,
        directions = this.directions,
        rotations = this.rotations,
        randoms = this.randoms,
        rp = ParticleEmitter.randlerp,
        m4 = mat4;

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
    for (var i = 0; i < lifeLen; i++) {
        // particle gets older;
        elapsed[i] += delta;
        // if particle's life is elapsed, it needs resurected;
        if (elapsed[i] > lives[i]) {
            // new lifespan;
            lives[i] = rp(minLife, maxLife, true);
            // new start point;
            starts.splice(i * 3, 3, rp(opts.minOffsetX, opts.maxOffsetX), rp(opts.minOffsetY, opts.maxOffsetY), rp(opts.minOffsetZ, opts.maxOffsetZ));
            // reset elapsed (negative elapsed creates delay);
            elapsed[i] = (-rp(minDelay, maxDelay));
            // determine a new directional vector;
            directions.splice(i * 3, 3, rp(minDirectionX, maxDirectionX), rp(minDirectionY, maxDirectionY), rp(minDirectionZ, maxDirectionZ));

            speeds[i] = rp(opts.minSpeed, opts.maxSpeed);
            rotations[i] = rp(opts.minRotation, opts.maxRotation);
            randoms[i] = Math.random();
        }

        //[x1, y1, minLimit, maxLimit, x2, y2, m(1, 2), b(1, 2), x3, y3, m(2, 3), b(2, 3)[, ...]]

        // direction X
        if (minDirectionXGraph) {
            var min,
                max,
                k = 0;

            // find the minline line segment at the current life value
            while (elapsed[i] / lives[i] > minDirectionXGraph[k + 4]) {
                k += 4;
            }

            // minline y-axis value for the line segment -- [k + 6] is the slope, [k + 7] is the y-intercept
            min = minDirectionXGraph[k + 6] * (elapsed[i] / lives[i]) + minDirectionXGraph[k + 7];

            // find the maxline line segment at the current life value
            k = 0;
            while (elapsed[i] / lives[i] > maxDirectionXGraph[k + 4]) {
                k += 4;
            }

            // maxline y-axis value for the line segment -- [k + 6] is the slope, [k + 7] is the y-intercept
            max = maxDirectionXGraph[k + 6] * (elapsed[i] / lives[i]) + maxDirectionXGraph[k + 7];
            // check for valid number
            if (max < Infinity && min < Infinity) {
                directions[i * 3] = ParticleEmitter.lerp(min, max, randoms[i]);
            }
        }

        // direction Y
        if (minDirectionYGraph) {
            var min,
                max,
                k = 0;

            while (elapsed[i] / lives[i] > minDirectionYGraph[k + 4]) {
                k += 4;
            }
            min = minDirectionYGraph[k + 6] * (elapsed[i] / lives[i]) + minDirectionYGraph[k + 7];
            k = 0;
            while (elapsed[i] / lives[i] > maxDirectionYGraph[k + 4]) {
                k += 4;
            }
            max = maxDirectionYGraph[k + 6] * (elapsed[i] / lives[i]) + maxDirectionYGraph[k + 7];
            if (max < Infinity && min < Infinity) {
                directions[i * 3 + 1] = ParticleEmitter.lerp(min, max, randoms[i]);
            }
        }

        // direction Z
        if (minDirectionZGraph) {
            var min,
                max,
                k = 0;

            while (elapsed[i] / lives[i] > minDirectionZGraph[k + 4]) {
                k += 4;
            }
            min = minDirectionZGraph[k + 6] * (elapsed[i] / lives[i]) + minDirectionZGraph[k + 7];
            k = 0;
            while (elapsed[i] / lives[i] > maxDirectionZGraph[k + 4]) {
                k += 4;
            }
            max = maxDirectionZGraph[k + 6] * (elapsed[i] / lives[i]) + maxDirectionZGraph[k + 7];
            if (max < Infinity && min < Infinity) {
                directions[i * 3 + 2] = ParticleEmitter.lerp(min, max, randoms[i]);
            }
        }


        // offset X
        if (minOffsetXGraph) {
            var min,
                max,
                k = 0;

            while (elapsed[i] / lives[i] > minOffsetXGraph[k + 4]) {
                k += 4;
            }
            min = ((minOffsetXGraph[k + 6] * (elapsed[i] / lives[i]) + minOffsetXGraph[k + 7]) + 1) * 0.5 * (minOffsetXGraph[2] - minOffsetXGraph[3]);
            k = 0;
            while (elapsed[i] / lives[i] > maxOffsetXGraph[k + 4]) {
                k += 4;
            }
            max = ((maxOffsetXGraph[k + 6] * (elapsed[i] / lives[i]) + minOffsetXGraph[k + 7]) + 1) * 0.5 * (maxOffsetXGraph[2] - maxOffsetXGraph[3]);
            if (max < Infinity && min < Infinity) {

                starts[i * 3] = ParticleEmitter.lerp(min, max, randoms[i]);
            }
        }

        // offset Y
        if (minOffsetYGraph) {
            var min,
                max,
                k = 0;

            while (elapsed[i] / lives[i] > minOffsetYGraph[k + 4]) {
                k += 4;
            }
            min = minOffsetYGraph[k + 6] * (elapsed[i] / lives[i]) + minOffsetYGraph[k + 7];
            k = 0;
            while (elapsed[i] / lives[i] > maxOffsetYGraph[k + 4]) {
                k += 4;
            }
            max = maxOffsetYGraph[k + 6] * (elapsed[i] / lives[i]) + maxOffsetYGraph[k + 7];
            if (max < Infinity && min < Infinity) {
                starts[i * 3 + 1] = ParticleEmitter.lerp(min, max, randoms[i]);
            }
        }

        // offset Z
        if (minOffsetZGraph) {
            var min,
                max,
                k = 0;

            while (elapsed[i] / lives[i] > minOffsetZGraph[k + 4]) {
                k += 4;
            }
            min = minOffsetZGraph[k + 6] * (elapsed[i] / lives[i]) + minOffsetZGraph[k + 7];
            k = 0;
            while (elapsed[i] / lives[i] > maxOffsetZGraph[k + 4]) {
                k += 4;
            }
            max = maxOffsetZGraph[k + 6] * (elapsed[i] / lives[i]) + maxOffsetZGraph[k + 7];
            if (max < Infinity && min < Infinity) {
                starts[i * 3 + 2] = ParticleEmitter.lerp(min, max, randoms[i]);
            }
        }

        // speed
        if (minSpeedGraph) {
            var min,
                max,
                k = 0;

            while (elapsed[i] / lives[i] > minSpeedGraph[k + 4]) {
                k += 4;
            }
            min = minSpeedGraph[k + 6] * (elapsed[i] / lives[i]) + minSpeedGraph[k + 7];
            k = 0;
            while (elapsed[i] / lives[i] > maxSpeedGraph[k + 4]) {
                k += 4;
            }
            max = maxSpeedGraph[k + 6] * (elapsed[i] / lives[i]) + maxSpeedGraph[k + 7];
            if (max < Infinity && min < Infinity) {
                speeds[i * 3] = ParticleEmitter.lerp(min, max, randoms[i]);
            }
        }

        // rotation
        if (minRotationGraph) {
            var min,
                max,
                k = 0;

            while (elapsed[i] / lives[i] > minRotationGraph[k + 4]) {
                k += 4;
            }
            min = minRotationGraph[k + 6] * (elapsed[i] / lives[i]) + minRotationGraph[k + 7];
            k = 0;
            while (elapsed[i] / lives[i] > maxRotationGraph[k + 4]) {
                k += 4;
            }
            max = maxRotationGraph[k + 6] * (elapsed[i] / lives[i]) + maxRotationGraph[k + 7];
            if (max < Infinity && min < Infinity) {
                rotations[i * 3] = ParticleEmitter.lerp(min, max, randoms[i]);
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
            starts[i * 3] + elapsed[i] * speeds[i] * directions[i * 3] / 100000,
            starts[i * 3 + 1] + elapsed[i] * speeds[i] * directions[i * 3 + 1] / 100000,
            starts[i * 3 + 2] + elapsed[i] * speeds[i] * directions[i * 3 + 2] / 100000
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
