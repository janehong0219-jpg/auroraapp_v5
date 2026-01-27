import FFT from 'fft.js';

export class AudioAnalyzer {
    private fft: any;
    private fftSize: number;
    private outputBuffer: number[];
    private phasor: number[];

    constructor(fftSize: number = 4096) {
        this.fftSize = fftSize;
        this.fft = new FFT(fftSize);
        this.outputBuffer = this.fft.createComplexArray();
        this.phasor = this.fft.createComplexArray();
    }

    analyze(timeDomainData: Float32Array): number[] {
        if (timeDomainData.length !== this.fftSize) {
            // Handle mismatch or padding if necessary, for now assume match
            // If data is smaller, zero pad. If larger, truncate.
            const input = this.fft.createComplexArray();
            for (let i = 0; i < Math.min(timeDomainData.length, this.fftSize); i++) {
                input[2 * i] = timeDomainData[i]; // Real part
                input[2 * i + 1] = 0;             // Imag part
            }
            this.fft.transform(this.outputBuffer, input);
        } else {
            // Optimization: write directly if possible, but Float32Array needs conversion to complex
            this.fft.toComplexArray(timeDomainData, this.phasor);
            this.fft.transform(this.outputBuffer, this.phasor);
        }

        // Compute magnitudes
        const magnitudes: number[] = [];
        // We only need the first half (Nyquist)
        for (let i = 0; i < this.fftSize / 2; i++) {
            const real = this.outputBuffer[2 * i];
            const imag = this.outputBuffer[2 * i + 1];
            magnitudes.push(Math.sqrt(real * real + imag * imag));
        }

        return magnitudes;
    }

    getHarmonics(pitch: number, sampleRate: number): { f1: number, f2: number, f3: number, score: number } {
        if (pitch <= 0 || !this.outputBuffer) return { f1: 0, f2: 0, f3: 0, score: 0 };

        const getMag = (freq: number) => {
            const bin = Math.round(freq * this.fftSize / sampleRate);
            if (bin < 0 || bin >= this.fftSize / 2) return 0;

            // Simple smoothing: take max of bin and neighbors
            // const idx = bin * 2; // Real part index
            // We already computed magnitudes in analyze(), but we didn't store them in class state
            // To avoid recomputing, we should probably access the magnitudes we just computed.
            // However, analyze() returns them. The caller should pass magnitudes back or we store them.
            // Let's assume for now we re-compute or access from a cached array if we want optimization.
            // Actually, since analyze() returns magnitudes, let's just make analyze() store them internally or require them passed here.
            // EASIER: Just calculate magnitude from outputBuffer (complex) for the specific bins.

            // Re-calculate magnitude for just this bin (cheaper than full array if not cached)
            const real = this.outputBuffer[2 * bin];
            const imag = this.outputBuffer[2 * bin + 1];
            return Math.sqrt(real * real + imag * imag);
        };

        const f1 = getMag(pitch);
        const f2 = getMag(pitch * 2);
        const f3 = getMag(pitch * 3);

        // Tone Richness Score: Ratio of harmonics to fundamental
        // A pure sine wave has score ~0. A rich tone has higher score.
        const score = (f2 + f3) / (f1 + 0.001);

        return { f1, f2, f3, score };
    }
}
