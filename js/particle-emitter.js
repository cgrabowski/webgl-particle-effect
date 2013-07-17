function ParticleEmitter (effect, opts, index) {
    var rp = ParticleEmitter.randlerp;
    this.effect = effect || null;
    for (var opt in opts) {
        if (opt === 'emitterName') {
            this.emitterName = opts.emitterName || ((index) ? "emitter " + index : "unnamed");
        }// else {
        //  this[opt] = opts[opt];
        //}
    }

    this.opts = {};
    for (var opt in opts) {
        if (typeof opts[opt] !== 'undefined') {
            this.opts[opt] = opts[opt];
        }
    }

    this.graphablesConfig = opts.graphablesConfig || 0;
    this.channelConfig = opts.channelConfig || 0;
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
    this.randoms = []
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

ParticleEmitter.prototype = Object.create(ParticleEffect.prototype);
ParticleEmitter.prototype.constructor = ParticleEmitter;

ParticleEmitter.prototype.render = function (delta) {
    var effect = this.effect,
        gl = effect.gl,
        text = this.texture,
        getShaderVar = effect.shaderManager('getShaderVariable'),
        mvpProjectionMatrixUniform = getShaderVar('mvpProjectionMatrixUniform'),
        vertexPositionAttribute = getShaderVar('vertexPositionAttribute'),
        textureCoordAttribute = getShaderVar('textureCoordAttribute'),
        samplerUniform = getShaderVar('samplerUniform'),
        _matrix = this._matrix,
        mMatrix = this.mMatrix,
        vMatrix = this.vMatrix,
        pMatrix = this.pMatrix,
        opts = this.opts,
        numParticles = opts.numParticles,
        minLife = opts.minLife,
        maxLife = opts.maxLife,
        minDelay = opts.minDelay,
        maxDelay = opts.maxDelay,
        minDirectionX = opts.minDirectionX,
        maxDirectionX = opts.maxDirectionX,
        minDirectionY = opts.minDirectionY,
        maxDirectionY = opts.maxDirectionY,
        minDirectionZ = opts.minDirectionZ,
        maxDirectionZ = opts.maxDirectionZ,
        lives = this.lives,
        elapsed = this.lifeElapsed,
        lifeLen = this.lives.length,
        starts = this.starts,
        speeds = this.speeds,
        directions = this.directions,
        rotations = this.rotations,
        randoms = this.randoms,
        graphablesConfig = opts.graphablesConfig,
        rp = ParticleEmitter.randlerp,
        m4 = mat4;

    //resurect dead particles with fresh randomized props;
    for (var i = 0; i < lifeLen; i++) {
        // particle gets older;
        elapsed[i] += delta;
        // if particle's life is elapsed, it needs resurected;
        if (elapsed[i] > lives[i]) {
            // new lifespan;
            //console.log(minLife, maxLife);
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
        /*
         ParticleEffect.FLAGS = {
         OFFSET_X_BIT: 1,
         OFFSET_Y_BIT: 2,
         OFFSET_Z_BIT: 4,
         SPEED_BIT: 8,
         DIRECTION_X_BIT: 16,
         DIRECTION_Y_BIT: 32,
         DIRECTION_Z_BIT: 64,
         ROTATION_BIT: 128
         };
         */
        //var config = this.graphablesConfig >>> 4;

        //while (config > 0) {
        //[V x1, y1, null, null, x2, y2, m, b, V x2, y2, m, b, [...]]
        var minArr = opts.minDirectionXTest,
            maxArr = opts.maxDirectionXTest,
            min,
            max,
            k = 0;

        while (elapsed[i] / lives[i] > minArr[k + 4]) {
            k += 4;
        }


        min = minArr[k + 6] * (elapsed[i] / lives[i]) + minArr[k + 7];

        k = 4;
        while (elapsed[i] / lives[i] > maxArr[k + 4]) {
            k += 4;
        }

        max = maxArr[k + 6] * (elapsed[i] / lives[i]) + maxArr[k + 7];

        if (max < Infinity && min < Infinity) {
            //directions[i * 3] += (i % 2) ? rp(0, max) / 50 : rp(0, min) / 50;
            directions[i * 3] = ParticleEmitter.lerp(min, max, randoms[i]);
        }
    }
    // config >>>= 1;
    //}

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
