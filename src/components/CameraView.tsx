import { useRef, useEffect, useState } from 'react';
import { FaceDetector } from '../ai/FaceDetector';
import { calculateEmbouchure, type EmbouchureMetrics } from '../ai/embouchureLogic';

interface CameraViewProps {
    onMetricsUpdate?: (metrics: EmbouchureMetrics | null) => void;
}

export const CameraView: React.FC<CameraViewProps> = ({ onMetricsUpdate }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isAiReady, setIsAiReady] = useState(false);
    const detectorRef = useRef<FaceDetector | null>(null);
    const requestRef = useRef<number | null>(null);

    useEffect(() => {
        async function setupCamera() {
            if (!videoRef.current) return;
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480, facingMode: 'user' }
                });
                videoRef.current.srcObject = stream;
                await new Promise((resolve) => {
                    if (videoRef.current) videoRef.current.onloadedmetadata = resolve;
                });
                videoRef.current.play();
            } catch (err) {
                console.error("Camera error:", err);
            }
        }

        async function setupAI() {
            const detector = new FaceDetector();
            await detector.init();
            detectorRef.current = detector;
            setIsAiReady(true);
            detectLoop();
        }

        setupCamera().then(() => setupAI());

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const detectLoop = async () => {
        if (!videoRef.current || !detectorRef.current || !canvasRef.current) return;

        if (videoRef.current.readyState === 4) { // HAVE_ENOUGH_DATA
            const faces = await detectorRef.current.estimateFaces(videoRef.current);

            // Draw
            const ctx = canvasRef.current.getContext('2d');
            if (ctx && faces && faces.length > 0) {
                const width = canvasRef.current.width;
                const height = canvasRef.current.height;
                ctx.clearRect(0, 0, width, height);

                // Draw mesh
                const face = faces[0];
                ctx.fillStyle = '#00ff00';

                // Visualize only the mouth area for performance and clarity
                const mouthIndices = [13, 14, 61, 291];
                mouthIndices.forEach(index => {
                    const kp = face.keypoints[index];
                    ctx.beginPath();
                    ctx.arc(kp.x, kp.y, 3, 0, 2 * Math.PI); // Larger dots for key landmarks
                    ctx.fillStyle = '#00cccc'; // Cyan
                    ctx.fill();
                });

                // Calculate Metrics
                if (onMetricsUpdate) {
                    const metrics = calculateEmbouchure(face.keypoints);
                    onMetricsUpdate(metrics);
                }
            }
        }

        // Throttle to ~30 FPS if needed, or just run max
        // requestRef.current = requestAnimationFrame(detectLoop);
        // Let's use setTimeout for a simplified 15fps as per request to save CPU
        setTimeout(() => {
            requestRef.current = requestAnimationFrame(detectLoop);
        }, 1000 / 15);
    };

    return (
        <div className="relative w-full h-full aspect-video bg-black/50 rounded-xl overflow-hidden">
            <video
                ref={videoRef}
                className="absolute top-0 left-0 w-full h-full object-cover transform -scale-x-100" // Mirror
                playsInline
                muted
            />
            <canvas
                ref={canvasRef}
                width={640}
                height={480}
                className="absolute top-0 left-0 w-full h-full transform -scale-x-100" // Match mirror
            />
            {!isAiReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white font-medium backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin"></div>
                        <span className="text-xs tracking-widest uppercase text-cyan-500">Initializing AI...</span>
                    </div>
                </div>
            )}
        </div>
    );
};
