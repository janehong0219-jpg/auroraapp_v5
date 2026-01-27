import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

export type VisualizerTheme = 'aurora' | 'sunset' | 'ocean';

export interface VisualizerHandle {
    draw: (magnitudes: number[]) => void;
}

interface VisualizerProps {
    theme?: VisualizerTheme;
}

const Visualizer = forwardRef<VisualizerHandle, VisualizerProps>(({ theme = 'aurora' }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

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
