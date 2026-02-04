class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 4096;
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;

        // 噪音門限（可動態調整）
        this.noiseGateThreshold = 0.01;

        // 監聽來自主線程的訊息
        this.port.onmessage = (event) => {
            if (event.data.type === 'set-threshold') {
                this.noiseGateThreshold = event.data.threshold;
                console.log(`🎚️ Audio Processor 噪音門限已更新: ${(this.noiseGateThreshold * 100).toFixed(1)}%`);
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
                // Buffer full, analyze and send
                const analysis = this.autoCorrelation(this.buffer, sampleRate);

                // 噪音門限：如果 RMS 低於閾值，發送靜音狀態
                if (analysis.rms < this.noiseGateThreshold) {
                    this.port.postMessage({
                        type: 'audio-data',
                        buffer: new Float32Array(this.bufferSize), // 靜音 buffer
                        pitch: 0,  // 無音高
                        rms: 0     // 零音量
                    });
                } else {
                    // 正常發送分析結果
                    this.port.postMessage({
                        type: 'audio-data',
                        buffer: this.buffer.slice(),
                        pitch: analysis.pitch,
                        rms: analysis.rms
                    });
                }

                this.bufferIndex = 0;
            }
        }

        return true;
    }

    // Improved Auto-correlation algorithm
    autoCorrelation(buffer, sampleRate) {
        // 1. Calculate RMS
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i] * buffer[i];
        }
        const rms = Math.sqrt(sum / buffer.length); // Volume (0.0 - 1.0 approx)

        // 提早返回：如果音量太小，不進行音高檢測（節省計算）
        if (rms < 0.001) return { pitch: -1, rms };

        // 2. Auto-correlation for Pitch
        // Flute range: B3 (246Hz) to D7 (2349Hz) approx.
        const MIN_FREQ = 60;   // Lower bound
        const MAX_FREQ = 3000;
        const MAX_LAG = Math.floor(sampleRate / MIN_FREQ);
        const MIN_LAG = Math.floor(sampleRate / MAX_FREQ);

        let bestCorrelation = -1;
        let bestLag = -1;

        for (let lag = MIN_LAG; lag <= MAX_LAG; lag++) {
            let correlation = 0;
            // Simple sum of products
            for (let i = 0; i < buffer.length - lag; i++) {
                correlation += buffer[i] * buffer[i + lag];
            }

            // Verify peak: normalize by signal energy? Ideally yes, but basic peak finding works usually.
            if (correlation > bestCorrelation) {
                bestCorrelation = correlation;
                bestLag = lag;
            }
        }

        let pitch = -1;
        if (bestCorrelation > 0.01) {
            // parabolic interpolation
            // preciseLag = lag + (alpha - gamma) / (2 * (alpha - 2*beta + gamma))
            // alpha = corr[lag-1], beta = corr[lag], gamma = corr[lag+1]

            // Need to compute neighbors
            let alpha = 0;
            let gamma = 0;

            // Compute alpha (bestLag - 1)
            if (bestLag > MIN_LAG) {
                for (let i = 0; i < buffer.length - (bestLag - 1); i++) {
                    alpha += buffer[i] * buffer[i + (bestLag - 1)];
                }
            }

            // Compute gamma (bestLag + 1)
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
