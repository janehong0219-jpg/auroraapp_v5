class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 4096;
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
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

                this.port.postMessage({
                    type: 'audio-data',
                    buffer: this.buffer.slice(),
                    pitch: analysis.pitch,
                    rms: analysis.rms
                });
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

        if (rms < 0.01) return { pitch: -1, rms }; // Too quiet

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
