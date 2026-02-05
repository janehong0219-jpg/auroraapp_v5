import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import type { PitchPoint, VolumePoint } from '../utils/PracticeDataBuffer';

export type VisualizerTheme = 'aurora' | 'sunset' | 'ocean';

export interface VisualizerHandle {
    draw: (magnitudes: number[]) => void;
}

interface VisualizerProps {
    theme?: VisualizerTheme;
    pitchHistory?: PitchPoint[];
    volumeHistory?: VolumePoint[];
    currentStability?: number;
    showPracticeOverlay?: boolean;
}

const Visualizer = forwardRef<VisualizerHandle, VisualizerProps>(({
    theme = 'aurora',
    pitchHistory = [],
    volumeHistory = [],
    currentStability = 0,
    showPracticeOverlay = true
}, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Draw pitch history track with color-coded stability
    const drawPitchTrack = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
        const trackHeight = height * 0.2;
        const trackY = height * 0.05;

        if (pitchHistory.length < 2) return;

        // Find min/max frequency for scaling
        const frequencies = pitchHistory.map(p => p.frequency);
        const minFreq = Math.min(...frequencies);
        const maxFreq = Math.max(...frequencies);
        const freqRange = maxFreq - minFreq || 100; // Avoid division by zero

        const pointWidth = width / Math.max(pitchHistory.length - 1, 1);

        // Draw segments with color-coded stability
        for (let i = 0; i < pitchHistory.length - 1; i++) {
            const point = pitchHistory[i];
            const nextPoint = pitchHistory[i + 1];

            const x1 = i * pointWidth;
            const x2 = (i + 1) * pointWidth;

            // Normalize frequency to track range
            const y1 = trackY + trackHeight - ((point.frequency - minFreq) / freqRange * trackHeight);
            const y2 = trackY + trackHeight - ((nextPoint.frequency - minFreq) / freqRange * trackHeight);

            // Color based on stability
            const stability = point.stability;
            let color;
            if (stability >= 70) {
                color = 'rgba(16, 185, 129, 0.8)'; // Green - stable
            } else if (stability >= 40) {
                color = 'rgba(245, 158, 11, 0.8)'; // Amber - moderate
            } else {
                color = 'rgba(239, 68, 68, 0.8)'; // Red - unstable
            }

            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        // Draw note labels at key points
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';

        // Show first, middle, and last note
        const keyIndices = [
            0,
            Math.floor(pitchHistory.length / 2),
            pitchHistory.length - 1
        ];

        keyIndices.forEach(i => {
            if (i < pitchHistory.length) {
                const point = pitchHistory[i];
                const x = i * pointWidth;
                const y = trackY + trackHeight - ((point.frequency - minFreq) / freqRange * trackHeight);
                ctx.fillText(point.note, x, y - 5);
            }
        });
    };

    // Draw volume envelope
    const drawVolumeEnvelope = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
        const envelopeHeight = height * 0.12;
        const envelopeY = height * 0.83;

        if (volumeHistory.length < 2) return;

        const pointWidth = width / Math.max(volumeHistory.length - 1, 1);

        ctx.fillStyle = 'rgba(100, 116, 139, 0.3)';
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.6)';
        ctx.lineWidth = 2;

        // Draw filled envelope
        ctx.beginPath();
        ctx.moveTo(0, envelopeY + envelopeHeight);

        volumeHistory.forEach((point, i) => {
            const x = i * pointWidth;
            const barHeight = (point.level / 100) * envelopeHeight;
            const y = envelopeY + envelopeHeight - barHeight;

            if (i === 0) {
                ctx.lineTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.lineTo(width, envelopeY + envelopeHeight);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw baseline
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, envelopeY + envelopeHeight);
        ctx.lineTo(width, envelopeY + envelopeHeight);
        ctx.stroke();
    };

    // Draw stability indicator
    const drawStabilityIndicator = (ctx: CanvasRenderingContext2D, width: number) => {
        const indicatorSize = 40;
        const x = width - indicatorSize - 15;
        const y = 15;

        // Determine color based on stability
        let color;
        if (currentStability >= 80) {
            color = '#10b981'; // Emerald - excellent
        } else if (currentStability >= 60) {
            color = '#06b6d4'; // Cyan - good
        } else if (currentStability >= 40) {
            color = '#f59e0b'; // Amber - needs work
        } else {
            color = '#ef4444'; // Red - poor
        }

        // Draw circle background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(x + indicatorSize / 2, y + indicatorSize / 2, indicatorSize / 2, 0, Math.PI * 2);
        ctx.fill();

        // Draw colored ring
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x + indicatorSize / 2, y + indicatorSize / 2, indicatorSize / 2 - 2, 0, Math.PI * 2);
        ctx.stroke();

        // Draw stability percentage
        ctx.fillStyle = color;
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${currentStability}`, x + indicatorSize / 2, y + indicatorSize / 2);
    };

    // Draw practice overlay layers
    const drawPracticeOverlay = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
        // Layer 1: Pitch History Track (top 20%)
        if (pitchHistory.length > 1) {
            drawPitchTrack(ctx, width, height);
        }

        // Layer 2: Volume Envelope (bottom 15%)
        if (volumeHistory.length > 1) {
            drawVolumeEnvelope(ctx, width, height);
        }

        // Layer 3: Stability Indicator (top right)
        if (currentStability > 0) {
            drawStabilityIndicator(ctx, width);
        }
    };

    useImperativeHandle(ref, () => ({
        draw: (magnitudes: number[]) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const width = canvas.width;
            const height = canvas.height;

            // Clear with slight fade for trail effect? Or just clear.
            ctx.clearRect(0, 0, width, height);

            // Configuration for the "Aurora" look
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowBlur = 15;

            // Create Theme Gradient
            const gradient = ctx.createLinearGradient(0, height, 0, 0);

            if (theme === 'sunset') {
                ctx.shadowColor = '#facc15'; // Yellow glow
                gradient.addColorStop(0, 'rgba(244, 63, 94, 0.2)'); // Rose (bottom)
                gradient.addColorStop(0.4, 'rgba(251, 146, 60, 0.6)'); // Orange
                gradient.addColorStop(1, 'rgba(168, 85, 247, 0.8)');   // Purple (top)
            } else if (theme === 'ocean') {
                ctx.shadowColor = '#0ea5e9'; // Sky blue glow
                gradient.addColorStop(0, 'rgba(30, 58, 138, 0.3)'); // Dark Blue (bottom)
                gradient.addColorStop(0.4, 'rgba(14, 165, 233, 0.6)'); // Sky Blue
                gradient.addColorStop(1, 'rgba(20, 184, 166, 0.8)');   // Teal (top)
            } else {
                // Aurora (Default)
                ctx.shadowColor = '#22d3ee'; // Cyan glow
                gradient.addColorStop(0, 'rgba(34, 197, 94, 0.2)'); // Emerald (bottom)
                gradient.addColorStop(0.4, 'rgba(34, 211, 238, 0.6)'); // Cyan
                gradient.addColorStop(1, 'rgba(168, 85, 247, 0.8)');   // Purple (top)
            }

            ctx.fillStyle = gradient;

            // Draw smooth curve
            ctx.beginPath();

            // We will draw a filled shape: Start bottom-left, go through points, end bottom-right, close path.
            // Downsample for smoothness if needed, or just iterate.
            // Let's use a subset of points to make it smoother than raw FFT bins
            const sliceWidth = width / (magnitudes.length > 0 ? magnitudes.length : 1);

            let x = 0;
            // Start point
            ctx.moveTo(0, height);

            // Draw curve
            // Note: magnitudes are 0-255.
            for (let i = 0; i < magnitudes.length; i++) {
                const value = magnitudes[i];
                const barHeight = Math.min((value / 255) * height * 1.2, height);
                const y = height - barHeight;

                // Simple lineTo for now, or quadraticCurveTo for super smooth
                // For "Aurora", let's try a simple smooth line first
                if (i === 0) {
                    ctx.lineTo(x, y);
                } else {
                    // Smooth curve strategy: use midpoint
                    const prevX = (i - 1) * sliceWidth;
                    const prevY = height - Math.min((magnitudes[i - 1] / 255) * height * 1.2, height);
                    const cx = (prevX + x) / 2;
                    const cy = (prevY + y) / 2;
                    ctx.quadraticCurveTo(prevX, prevY, cx, cy);
                }

                x += sliceWidth;
            }

            // Finish path
            ctx.lineTo(width, height);
            ctx.closePath();
            ctx.fill();

            // Optional: Draw a thin line on top for definition
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.stroke();

            // Draw practice overlay if enabled
            if (showPracticeOverlay) {
                drawPracticeOverlay(ctx, width, height);
            }
        }
    }));

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    }, [theme]);

    return (
        <div className="w-full h-full min-h-[200px] flex items-end">
            <canvas
                ref={canvasRef}
                width={800}
                height={256}
                className="w-full h-full block"
            />
        </div>
    );
});

export default Visualizer;
