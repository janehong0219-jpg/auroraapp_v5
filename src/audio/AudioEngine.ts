export class AudioEngine {
    public context: AudioContext | null = null;
    private workletNode: AudioWorkletNode | null = null;
    private stream: MediaStream | null = null;
    private onAudioDataCallback: ((data: Float32Array, pitch?: number, rms?: number) => void) | null = null;

    constructor() {
        this.context = null;
    }

    async init(onAudioData: (data: Float32Array, pitch?: number, rms?: number) => void) {
        this.onAudioDataCallback = onAudioData;
        this.context = new AudioContext();

        try {
            await this.context.audioWorklet.addModule('/audio-processor.js');

            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = this.context.createMediaStreamSource(this.stream);

            this.workletNode = new AudioWorkletNode(this.context, 'audio-processor');

            this.workletNode.port.onmessage = (event) => {
                if (event.data.type === 'audio-data' && this.onAudioDataCallback) {
                    this.onAudioDataCallback(event.data.buffer, event.data.pitch, event.data.rms);
                }
            };

            source.connect(this.workletNode);
            // Connect to destination if you want to hear it (usually not for analysis)
            // this.workletNode.connect(this.context.destination);

            console.log('Audio Engine initialized');
        } catch (error) {
            console.error('Error initializing Audio Engine:', error);
            throw error;
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
