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
                const pitch = this.autoCorrelation(this.buffer, sampleRate);

                this.port.postMessage({
                    type: 'audio-data',
                    buffer: this.buffer.slice(),
                    pitch: pitch // Send calculated pitch
                });
                this.bufferIndex = 0;
            }
        }

        return true;
    }

    // Simple Auto-correlation algorithm
    autoCorrelation(buffer, sampleRate) {
        // 1. Calculate RMS to check for silence
        let rms = 0;
        for (let i = 0; i < buffer.length; i++) {
            rms += buffer[i] * buffer[i];
        }
        rms = Math.sqrt(rms / buffer.length);
        if (rms < 0.01) return -1; // Too quiet

        // 2. Auto-correlation
        // We only need to search a range of lags corresponding to reasonable flute frequencies
        // Flute range: B3 (246Hz) to D7 (2349Hz) approx.
        // Let's search 50Hz to 3000Hz to be safe.
        // Lag = sampleRate / frequency

        const MIN_FREQ = 50;
        const MAX_FREQ = 3000;
        const MAX_LAG = Math.floor(sampleRate / MIN_FREQ);
        const MIN_LAG = Math.floor(sampleRate / MAX_FREQ);

        let bestCorrelation = -1;
        let bestLag = -1;

        for (let lag = MIN_LAG; lag <= MAX_LAG; lag++) {
            let correlation = 0;
            // Normalize correlation could be better but standard sum-product is okay for now
            // Iterate over the buffer, but stop before we run out of data for the lag
            for (let i = 0; i < buffer.length - lag; i++) {
                correlation += buffer[i] * buffer[i + lag];
            }

            // Normalize by the number of samples summed to be fair to different lags? 
            // Or just straightforward AC.
            // Usually: cor[lag] = sum(x[i] * x[i+lag])

            if (correlation > bestCorrelation) {
                bestCorrelation = correlation;
                bestLag = lag;
            }
        }

        // Refinement: Parabolic interpolation for better precision could be added here

        if (bestCorrelation > 0.01) { // Threshold
            return sampleRate / bestLag;
        }

        return -1;
    }
}

registerProcessor('audio-processor', AudioProcessor);
