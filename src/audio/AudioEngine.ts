export interface AudioEngineOptions {
    highPassCutoff?: number;      // 高通濾波器截止頻率 (Hz)
    noiseGateThreshold?: number;  // 噪音門限
}

export class AudioEngine {
    public context: AudioContext | null = null;
    private workletNode: AudioWorkletNode | null = null;
    private stream: MediaStream | null = null;
    private onAudioDataCallback: ((data: Float32Array, pitch?: number, rms?: number) => void) | null = null;

    // 噪音抑制相關
    private highPassFilter: BiquadFilterNode | null = null;
    private noiseGateThreshold: number = 0.01;

    constructor() {
        this.context = null;
    }

    async init(
        onAudioData: (data: Float32Array, pitch?: number, rms?: number) => void,
        options: AudioEngineOptions = {}
    ) {
        this.onAudioDataCallback = onAudioData;
        this.context = new AudioContext();

        // 設定噪音門限
        this.noiseGateThreshold = options.noiseGateThreshold || 0.01;

        try {
            await this.context.audioWorklet.addModule('/audio-processor.js');

            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = this.context.createMediaStreamSource(this.stream);

            // 創建高通濾波器（過濾低頻噪音）
            this.highPassFilter = this.context.createBiquadFilter();
            this.highPassFilter.type = 'highpass';
            this.highPassFilter.frequency.value = options.highPassCutoff || 150; // 預設 150 Hz
            this.highPassFilter.Q.value = 0.7; // 平滑過渡，避免失真

            this.workletNode = new AudioWorkletNode(this.context, 'audio-processor');

            // 傳遞噪音門限到 worklet
            this.workletNode.port.postMessage({
                type: 'set-threshold',
                threshold: this.noiseGateThreshold
            });

            this.workletNode.port.onmessage = (event) => {
                if (event.data.type === 'audio-data' && this.onAudioDataCallback) {
                    this.onAudioDataCallback(event.data.buffer, event.data.pitch, event.data.rms);
                }
            };

            // 音頻處理鏈: source -> 高通濾波器 -> worklet
            source.connect(this.highPassFilter);
            this.highPassFilter.connect(this.workletNode);

            // 不連接到 destination，避免回音
            // this.workletNode.connect(this.context.destination);

            console.log('✅ Audio Engine 已初始化（含噪音抑制）');
            console.log(`   - 高通濾波器: ${this.highPassFilter.frequency.value} Hz`);
            console.log(`   - 噪音門限: ${(this.noiseGateThreshold * 100).toFixed(1)}%`);
        } catch (error) {
            console.error('❌ Audio Engine 初始化失敗:', error);
            throw error;
        }
    }

    /**
     * 動態調整高通濾波器截止頻率
     * @param frequency 截止頻率 (Hz)，建議範圍: 50-300
     */
    setHighPassCutoff(frequency: number) {
        if (this.highPassFilter && this.context) {
            this.highPassFilter.frequency.setValueAtTime(
                frequency,
                this.context.currentTime
            );
            console.log(`🔧 高通濾波器已調整至: ${frequency} Hz`);
        }
    }

    /**
     * 動態調整噪音門限
     * @param threshold 門限值 (0.0-1.0)，建議範圍: 0.005-0.05
     */
    setNoiseGateThreshold(threshold: number) {
        this.noiseGateThreshold = threshold;
        if (this.workletNode) {
            this.workletNode.port.postMessage({
                type: 'set-threshold',
                threshold: threshold
            });
            console.log(`🔧 噪音門限已調整至: ${(threshold * 100).toFixed(1)}%`);
        }
    }

    suspend() {
        this.context?.suspend();
    }

    resume() {
        this.context?.resume();
    }

    stop() {
        this.context?.close();
        this.stream?.getTracks().forEach(track => track.stop());
    }
}
