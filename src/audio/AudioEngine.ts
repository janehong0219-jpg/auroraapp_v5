export interface AudioEngineOptions {
    highPassCutoff?: number;      // 高通濾波器截止頻率 (Hz)
    lowPassCutoff?: number;       // 低通濾波器截止頻率 (Hz) - 新增
    noiseGateThreshold?: number;  // 噪音門限
    instrumentMode?: 'flute' | 'vocal' | 'general';  // 樂器模式
}

export class AudioEngine {
    public context: AudioContext | null = null;
    private workletNode: AudioWorkletNode | null = null;
    private stream: MediaStream | null = null;
    private onAudioDataCallback: ((data: Float32Array, pitch?: number, rms?: number) => void) | null = null;

    // 噪音抑制相關
    private highPassFilter: BiquadFilterNode | null = null;
    private lowPassFilter: BiquadFilterNode | null = null;  // 新增低通濾波器
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

        // 根據樂器模式設定濾波器參數
        const instrumentMode = options.instrumentMode || 'flute';
        let highPassFreq = options.highPassCutoff || 150;
        let lowPassFreq = options.lowPassCutoff || 3000;
        let threshold = options.noiseGateThreshold || 0.02;

        // 長笛專用設定：B3 (246Hz) 到 D7 (2349Hz)
        if (instrumentMode === 'flute') {
            highPassFreq = 200;   // 過濾 200Hz 以下（排除人聲低頻、環境噪音）
            lowPassFreq = 2500;   // 過濾 2500Hz 以上（排除高頻噪音）
            threshold = 0.025;    // 稍高的門限
        }

        this.noiseGateThreshold = threshold;

        try {
            await this.context.audioWorklet.addModule('/audio-processor.js');

            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,      // 開啟回音消除
                    noiseSuppression: true,      // 開啟噪音抑制
                    autoGainControl: false       // 關閉自動增益（保持音量穩定）
                }
            });
            const source = this.context.createMediaStreamSource(this.stream);

            // 創建高通濾波器（過濾低頻噪音和人聲低頻）
            this.highPassFilter = this.context.createBiquadFilter();
            this.highPassFilter.type = 'highpass';
            this.highPassFilter.frequency.value = highPassFreq;
            this.highPassFilter.Q.value = 1.0;

            // 創建低通濾波器（過濾高頻噪音）
            this.lowPassFilter = this.context.createBiquadFilter();
            this.lowPassFilter.type = 'lowpass';
            this.lowPassFilter.frequency.value = lowPassFreq;
            this.lowPassFilter.Q.value = 1.0;

            this.workletNode = new AudioWorkletNode(this.context, 'audio-processor');

            // 傳遞噪音門限和樂器模式到 worklet
            this.workletNode.port.postMessage({
                type: 'init-settings',
                threshold: this.noiseGateThreshold,
                instrumentMode: instrumentMode
            });

            this.workletNode.port.onmessage = (event) => {
                if (event.data.type === 'audio-data' && this.onAudioDataCallback) {
                    this.onAudioDataCallback(event.data.buffer, event.data.pitch, event.data.rms);
                }
            };

            // 音頻處理鏈: source -> 高通 -> 低通 -> worklet
            source.connect(this.highPassFilter);
            this.highPassFilter.connect(this.lowPassFilter);
            this.lowPassFilter.connect(this.workletNode);

            console.log('✅ Audio Engine 已初始化（長笛專用模式）');
            console.log(`   - 高通濾波器: ${highPassFreq} Hz（排除低頻噪音）`);
            console.log(`   - 低通濾波器: ${lowPassFreq} Hz（排除高頻噪音）`);
            console.log(`   - 噪音門限: ${(this.noiseGateThreshold * 100).toFixed(1)}%`);
            console.log(`   - 樂器模式: ${instrumentMode}`);
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
     * 動態調整低通濾波器截止頻率
     * @param frequency 截止頻率 (Hz)，建議範圍: 2000-4000
     */
    setLowPassCutoff(frequency: number) {
        if (this.lowPassFilter && this.context) {
            this.lowPassFilter.frequency.setValueAtTime(
                frequency,
                this.context.currentTime
            );
            console.log(`🔧 低通濾波器已調整至: ${frequency} Hz`);
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
