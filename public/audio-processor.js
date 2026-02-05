class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 1024;
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;

        // 噪音門限
        this.noiseGateThreshold = 0.025;

        // 音高穩定性檢查（過濾噪音造成的不穩定音高）
        this.lastPitches = [];
        this.maxPitchHistory = 3;  // 保留最近 3 次音高
        this.pitchStabilityThreshold = 0.05; // 5% 以內算穩定

        // 長笛頻率範圍
        this.minFreq = 200;   // 長笛最低約 B3 = 246Hz
        this.maxFreq = 2500;  // 長笛最高約 D7 = 2349Hz

        // 樂器模式
        this.instrumentMode = 'flute';

        // 監聽來自主線程的訊息
        this.port.onmessage = (event) => {
            if (event.data.type === 'set-threshold') {
                this.noiseGateThreshold = event.data.threshold;
            }
            if (event.data.type === 'init-settings') {
                this.noiseGateThreshold = event.data.threshold || 0.025;
                this.instrumentMode = event.data.instrumentMode || 'flute';

                // 根據樂器調整頻率範圍
                if (this.instrumentMode === 'flute') {
                    this.minFreq = 200;
                    this.maxFreq = 2500;
                } else if (this.instrumentMode === 'vocal') {
                    this.minFreq = 80;
                    this.maxFreq = 1000;
                } else {
                    this.minFreq = 60;
                    this.maxFreq = 3000;
                }
            }
        };
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (!input || input.length === 0) return true;

        const channelData = input[0];

        // Fill the buffer
        for (let i = 0; i < channelData.length; i++) {
            this.buffer[this.bufferIndex++] = channelData[i];

            if (this.bufferIndex >= this.bufferSize) {
                const analysis = this.autoCorrelation(this.buffer, sampleRate);

                // 噪音門限檢查
                if (analysis.rms < this.noiseGateThreshold) {
                    this.port.postMessage({
                        type: 'audio-data',
                        buffer: new Float32Array(this.bufferSize),
                        pitch: 0,
                        rms: 0
                    });
                    this.lastPitches = []; // 清空歷史
                } else {
                    // 音高穩定性檢查
                    const stablePitch = this.getStablePitch(analysis.pitch);

                    this.port.postMessage({
                        type: 'audio-data',
                        buffer: this.buffer.slice(),
                        pitch: stablePitch,
                        rms: analysis.rms
                    });
                }

                this.bufferIndex = 0;
            }
        }

        return true;
    }

    // 音高穩定性檢查
    getStablePitch(rawPitch) {
        // 如果音高不在樂器範圍內，視為噪音
        if (rawPitch < this.minFreq || rawPitch > this.maxFreq) {
            return 0;
        }

        // 添加到歷史
        this.lastPitches.push(rawPitch);
        if (this.lastPitches.length > this.maxPitchHistory) {
            this.lastPitches.shift();
        }

        // 如果歷史不夠，直接返回
        if (this.lastPitches.length < 2) {
            return rawPitch;
        }

        // 計算平均值
        const avg = this.lastPitches.reduce((a, b) => a + b, 0) / this.lastPitches.length;

        // 檢查穩定性（所有值都在平均值 ±5% 內）
        const isStable = this.lastPitches.every(p => {
            const deviation = Math.abs(p - avg) / avg;
            return deviation < this.pitchStabilityThreshold;
        });

        if (isStable) {
            return avg; // 返回平均值（更穩定）
        } else {
            // 不穩定，可能是噪音，返回 0 或最新值
            // 這裡選擇返回最新值但標記為可能不穩定
            return rawPitch;
        }
    }

    // Auto-correlation 音高檢測
    autoCorrelation(buffer, sampleRate) {
        // 1. Calculate RMS
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i] * buffer[i];
        }
        const rms = Math.sqrt(sum / buffer.length);

        if (rms < 0.001) return { pitch: -1, rms };

        // 2. Auto-correlation
        const MAX_LAG = Math.floor(sampleRate / this.minFreq);
        const MIN_LAG = Math.floor(sampleRate / this.maxFreq);

        let bestCorrelation = -1;
        let bestLag = -1;

        for (let lag = MIN_LAG; lag <= MAX_LAG; lag++) {
            let correlation = 0;
            for (let i = 0; i < buffer.length - lag; i++) {
                correlation += buffer[i] * buffer[i + lag];
            }

            if (correlation > bestCorrelation) {
                bestCorrelation = correlation;
                bestLag = lag;
            }
        }

        let pitch = -1;
        if (bestCorrelation > 0.01 && bestLag > 0) {
            // Parabolic interpolation for better accuracy
            let alpha = 0;
            let gamma = 0;

            if (bestLag > MIN_LAG) {
                for (let i = 0; i < buffer.length - (bestLag - 1); i++) {
                    alpha += buffer[i] * buffer[i + (bestLag - 1)];
                }
            }

            if (bestLag < MAX_LAG) {
                for (let i = 0; i < buffer.length - (bestLag + 1); i++) {
                    gamma += buffer[i] * buffer[i + (bestLag + 1)];
                }
            }

            const beta = bestCorrelation;
            const den = 2 * (alpha - 2 * beta + gamma);

            let delta = 0;
            if (den !== 0) delta = (alpha - gamma) / den;

            const trueLag = bestLag + delta;
            pitch = sampleRate / trueLag;
        }

        return { pitch, rms };
    }
}

registerProcessor('audio-processor', AudioProcessor);
