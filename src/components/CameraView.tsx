import { useRef, useEffect, useState } from 'react';
import { FaceDetector } from '../ai/FaceDetector';
import { PostureDetector, type ShoulderMetrics } from '../ai/PostureDetector';
import { calculateUnifiedEmbouchure, type UnifiedEmbouchureMetrics } from '../ai/embouchureLogic';

interface CameraViewProps {
    monitoringMode: 'vocal' | 'flute' | 'reed';
    onMetricsUpdate?: (metrics: UnifiedEmbouchureMetrics | null) => void;
    onShoulderMetricsUpdate?: (metrics: ShoulderMetrics | null) => void;
}

export const CameraView: React.FC<CameraViewProps> = ({ monitoringMode, onMetricsUpdate, onShoulderMetricsUpdate }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isAiReady, setIsAiReady] = useState(false);
    const detectorRef = useRef<FaceDetector | null>(null);
    const postureDetectorRef = useRef<PostureDetector | null>(null);
    const requestRef = useRef<number | null>(null);
    const postureIntervalRef = useRef<any>(null);

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

            // 初始化姿勢偵測器（僅長笛模式）
            if (monitoringMode === 'flute') {
                try {
                    const postureDetector = new PostureDetector();
                    await postureDetector.init();
                    postureDetectorRef.current = postureDetector;
                    console.log('✅ PostureDetector initialized');

                    // 獨立的姿勢偵測循環 - 每3秒偵測一次（不阻塞渲染）
                    postureIntervalRef.current = setInterval(async () => {
                        if (postureDetectorRef.current && videoRef.current && videoRef.current.readyState === 4) {
                            try {
                                const metrics = await postureDetectorRef.current.detect(videoRef.current);
                                if (metrics) {
                                    if (onShoulderMetricsUpdate) {
                                        onShoulderMetricsUpdate(metrics);
                                    }
                                }
                            } catch (err) {
                                console.warn('Posture detection error:', err);
                            }
                        }
                    }, 3000); // 每3秒偵測一次
                } catch (error) {
                    console.warn('PostureDetector init failed:', error);
                }
            }

            setIsAiReady(true);
            detectLoop();
        }

        setupCamera().then(() => setupAI());

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            if (postureIntervalRef.current) clearInterval(postureIntervalRef.current);
            if (postureDetectorRef.current) postureDetectorRef.current.dispose();
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const detectLoop = () => {
        if (!videoRef.current || !detectorRef.current || !canvasRef.current) return;

        if (videoRef.current.readyState === 4) {
            detectorRef.current.estimateFaces(videoRef.current).then(faces => {
                const ctx = canvasRef.current?.getContext('2d');
                if (ctx && canvasRef.current && faces && faces.length > 0) {
                    const width = canvasRef.current.width;
                    const height = canvasRef.current.height;
                    ctx.clearRect(0, 0, width, height);

                    const face = faces[0];

                    // 根據監測模式顯示不同的關鍵點
                    let landmarksToVisualize: number[] = [];
                    if (monitoringMode === 'vocal') {
                        landmarksToVisualize = [13, 14, 61, 291];
                    } else if (monitoringMode === 'flute') {
                        landmarksToVisualize = [61, 291, 19, 164];
                    } else if (monitoringMode === 'reed') {
                        landmarksToVisualize = [50, 280, 172, 397, 152];
                    }

                    landmarksToVisualize.forEach(index => {
                        const kp = face.keypoints[index];
                        if (kp) {
                            ctx.beginPath();
                            ctx.arc(kp.x, kp.y, 3, 0, 2 * Math.PI);
                            ctx.fillStyle = '#00cccc';
                            ctx.fill();
                        }
                    });

                    // Calculate Metrics
                    if (onMetricsUpdate) {
                        const metrics = calculateUnifiedEmbouchure(face.keypoints, monitoringMode);
                        onMetricsUpdate(metrics);

                        // 視覺警告：檢測到微笑緊張
                        if (metrics?.mode === 'flute' && metrics.flute?.smileTension?.isTooWide) {
                            ctx.strokeStyle = 'rgba(245, 158, 11, 0.9)';
                            ctx.lineWidth = 8;
                            ctx.strokeRect(10, 10, width - 20, height - 20);

                            ctx.fillStyle = 'rgb(245, 158, 11)';
                            ctx.font = 'bold 24px sans-serif';
                            ctx.fillText('⚠️ 嘴型變成 O，不要笑！', 40, 50);
                        }
                    }
                }
            });
        }

        setTimeout(() => {
            requestRef.current = requestAnimationFrame(detectLoop);
        }, 1000 / 15);
    };

    return (
        <div className="relative w-full h-full aspect-video bg-black/50 rounded-xl overflow-hidden">
            <video
                ref={videoRef}
                className="absolute top-0 left-0 w-full h-full object-cover transform -scale-x-100"
                playsInline
                muted
            />
            <canvas
                ref={canvasRef}
                width={640}
                height={480}
                className="absolute top-0 left-0 w-full h-full transform -scale-x-100"
            />
            {!isAiReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                        <p>載入 AI 模型中...</p>
                    </div>
                </div>
            )}
        </div>
    );
};
