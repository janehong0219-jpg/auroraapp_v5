/**
 * 練習分析組件 - 成長曲線視覺化
 */

import { useState, useEffect, useRef } from 'react';
import type { PracticeSession } from '../utils/generatePracticeData';
import { calculateStatistics } from '../utils/generatePracticeData';
import { fetchPracticeSessions } from '../services/PracticeSessionService';

interface PracticeAnalyticsProps {
    onClose?: () => void;
}

export function PracticeAnalytics({ onClose }: PracticeAnalyticsProps) {
    const [sessions, setSessions] = useState<PracticeSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [selectedMetric, setSelectedMetric] = useState<'overall' | 'pitch' | 'tone' | 'posture'>('overall');

    // 載入練習數據
    useEffect(() => {
        loadSessions();
    }, []);

    const loadSessions = async () => {
        try {
            setLoading(true);
            const data = await fetchPracticeSessions(100);
            setSessions(data);
            setError(null);
        } catch (err) {
            console.error(err);
            setError('無法載入練習數據');
        } finally {
            setLoading(false);
        }
    };

    // 繪製成長曲線
    useEffect(() => {
        if (!canvasRef.current || sessions.length === 0) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 設定 canvas 大小（高解析度）
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;

        // 清空畫布
        ctx.clearRect(0, 0, width, height);

        // 繪製背景網格
        drawGrid(ctx, width, height);

        // 準備數據
        const dataPoints = sessions.map(s => {
            switch (selectedMetric) {
                case 'pitch':
                    return s.pitchAccuracy.inTunePercentage;
                case 'tone':
                    return s.toneQuality.harmonicsScore;
                case 'posture':
                    return s.postureMetrics.overallPosture;
                default:
                    return s.overallScore;
            }
        });

        // 繪製曲線
        drawCurve(ctx, dataPoints, width, height, selectedMetric);

        // 繪製數據點
        drawDataPoints(ctx, dataPoints, width, height);

        // 繪製座標軸標籤
        drawAxisLabels(ctx, width, height, sessions.length);

    }, [sessions, selectedMetric]);

    // 繪製網格
    const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
        const padding = 50;
        const gridWidth = width - padding * 2;
        const gridHeight = height - padding * 2;

        ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
        ctx.lineWidth = 1;

        // 水平線（5 條）
        for (let i = 0; i <= 5; i++) {
            const y = padding + (gridHeight / 5) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(width - padding, y);
            ctx.stroke();
        }

        // 垂直線（10 條）
        for (let i = 0; i <= 10; i++) {
            const x = padding + (gridWidth / 10) * i;
            ctx.beginPath();
            ctx.moveTo(x, padding);
            ctx.lineTo(x, height - padding);
            ctx.stroke();
        }
    };

    // 繪製曲線
    const drawCurve = (
        ctx: CanvasRenderingContext2D,
        data: number[],
        width: number,
        height: number,
        metric: string
    ) => {
        if (data.length < 2) return;

        const padding = 50;
        const gridWidth = width - padding * 2;
        const gridHeight = height - padding * 2;

        const maxValue = 100;
        const minValue = 0;

        // 建立漸層
        const gradient = ctx.createLinearGradient(padding, padding, width - padding, padding);

        if (metric === 'overall') {
            gradient.addColorStop(0, 'rgba(239, 68, 68, 0.8)');   // 紅
            gradient.addColorStop(0.5, 'rgba(251, 191, 36, 0.8)'); // 黃
            gradient.addColorStop(1, 'rgba(34, 197, 94, 0.8)');    // 綠
        } else if (metric === 'pitch') {
            gradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');   // 藍
            gradient.addColorStop(1, 'rgba(147, 51, 234, 0.8)');   // 紫
        } else if (metric === 'tone') {
            gradient.addColorStop(0, 'rgba(236, 72, 153, 0.8)');   // 粉
            gradient.addColorStop(1, 'rgba(249, 115, 22, 0.8)');   // 橙
        } else {
            gradient.addColorStop(0, 'rgba(6, 182, 212, 0.8)');    // 青
            gradient.addColorStop(1, 'rgba(34, 197, 94, 0.8)');    // 綠
        }

        // 繪製填充區域
        ctx.beginPath();
        ctx.moveTo(padding, height - padding);

        data.forEach((value, index) => {
            const x = padding + (gridWidth / (data.length - 1)) * index;
            const y = height - padding - ((value - minValue) / (maxValue - minValue)) * gridHeight;

            if (index === 0) {
                ctx.lineTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.lineTo(width - padding, height - padding);
        ctx.closePath();

        const fillGradient = ctx.createLinearGradient(0, padding, 0, height - padding);
        fillGradient.addColorStop(0, gradient.toString().replace('0.8', '0.3'));
        fillGradient.addColorStop(1, gradient.toString().replace('0.8', '0.05'));
        ctx.fillStyle = fillGradient;
        ctx.fill();

        // 繪製線條
        ctx.beginPath();
        data.forEach((value, index) => {
            const x = padding + (gridWidth / (data.length - 1)) * index;
            const y = height - padding - ((value - minValue) / (maxValue - minValue)) * gridHeight;

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    };

    // 繪製數據點
    const drawDataPoints = (
        ctx: CanvasRenderingContext2D,
        data: number[],
        width: number,
        height: number
    ) => {
        const padding = 50;
        const gridWidth = width - padding * 2;
        const gridHeight = height - padding * 2;
        const maxValue = 100;
        const minValue = 0;

        // 只顯示部分數據點（避免過於擁擠）
        const step = Math.ceil(data.length / 20);

        data.forEach((value, index) => {
            if (index % step !== 0 && index !== data.length - 1) return;

            const x = padding + (gridWidth / (data.length - 1)) * index;
            const y = height - padding - ((value - minValue) / (maxValue - minValue)) * gridHeight;

            // 繪製外圈
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fillStyle = 'white';
            ctx.fill();

            // 繪製內圈
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);

            // 根據分數決定顏色
            if (value >= 80) {
                ctx.fillStyle = 'rgba(34, 197, 94, 1)';  // 綠
            } else if (value >= 60) {
                ctx.fillStyle = 'rgba(251, 191, 36, 1)'; // 黃
            } else {
                ctx.fillStyle = 'rgba(239, 68, 68, 1)';  // 紅
            }
            ctx.fill();
        });
    };

    // 繪製座標軸標籤
    const drawAxisLabels = (
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        dataLength: number
    ) => {
        const padding = 50;

        ctx.fillStyle = '#64748b';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';

        // X 軸標籤（練習次數）
        for (let i = 0; i <= 10; i++) {
            const x = padding + ((width - padding * 2) / 10) * i;
            const label = Math.round((dataLength / 10) * i);
            ctx.fillText(String(label), x, height - padding + 20);
        }

        ctx.textAlign = 'right';
        // Y 軸標籤（分數）
        for (let i = 0; i <= 5; i++) {
            const y = padding + ((height - padding * 2) / 5) * (5 - i);
            const value = (100 / 5) * i;
            ctx.fillText(String(value), padding - 10, y + 4);
        }

        // 軸標題
        ctx.save();
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = '#475569';

        // X 軸標題
        ctx.textAlign = 'center';
        ctx.fillText('練習次數', width / 2, height - 10);

        // Y 軸標題
        ctx.translate(15, height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('評分', 0, 0);
        ctx.restore();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600 font-medium">載入練習數據中...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
                <p className="text-red-600 font-semibold">{error}</p>
                <button
                    onClick={loadSessions}
                    className="mt-4 px-4 py-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                >
                    重試
                </button>
            </div>
        );
    }

    if (sessions.length === 0) {
        return (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center">
                <p className="text-slate-600 font-medium text-lg mb-2">尚無練習數據</p>
                <p className="text-slate-500 text-sm">開始練習並儲存紀錄後，這裡會顯示您的成長曲線</p>
            </div>
        );
    }

    const stats = calculateStatistics(sessions);

    return (
        <div className="space-y-6">
            {/* 標題列 */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-700">📊 練習分析</h2>
                    <p className="text-sm text-slate-500">追蹤您的成長軌跡</p>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-slate-600">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            {/* 指標選擇 */}
            <div className="flex gap-2 flex-wrap">
                {[
                    { key: 'overall' as const, label: '綜合評分', icon: '🎯' },
                    { key: 'pitch' as const, label: '音準', icon: '🎵' },
                    { key: 'tone' as const, label: '音色', icon: '🎨' },
                    { key: 'posture' as const, label: '姿勢', icon: '🧘' }
                ].map(metric => (
                    <button
                        key={metric.key}
                        onClick={() => setSelectedMetric(metric.key)}
                        className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${selectedMetric === metric.key
                                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-md'
                                : 'bg-white/50 text-slate-600 hover:bg-white/80 border border-slate-200'
                            }`}
                    >
                        {metric.icon} {metric.label}
                    </button>
                ))}
            </div>

            {/* 成長曲線圖 */}
            <div className="bg-white/40 backdrop-blur-xl border border-white/40 rounded-[2.5rem] p-6 shadow-sm">
                <canvas
                    ref={canvasRef}
                    className="w-full"
                    style={{ height: '400px' }}
                />
            </div>

            {/* 統計摘要 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/40 backdrop-blur-xl border border-white/40 rounded-2xl p-4 text-center">
                    <div className="text-2xl font-black text-emerald-600">{stats.totalSessions}</div>
                    <div className="text-xs text-slate-500 uppercase tracking-widest mt-1">總練習次數</div>
                </div>
                <div className="bg-white/40 backdrop-blur-xl border border-white/40 rounded-2xl p-4 text-center">
                    <div className="text-2xl font-black text-cyan-600">{stats.averageScore}</div>
                    <div className="text-xs text-slate-500 uppercase tracking-widest mt-1">平均分數</div>
                </div>
                <div className="bg-white/40 backdrop-blur-xl border border-white/40 rounded-2xl p-4 text-center">
                    <div className="text-2xl font-black text-purple-600">+{stats.improvementRate}%</div>
                    <div className="text-xs text-slate-500 uppercase tracking-widest mt-1">進步幅度</div>
                </div>
                <div className="bg-white/40 backdrop-blur-xl border border-white/40 rounded-2xl p-4 text-center">
                    <div className="text-2xl font-black text-orange-600">{(stats.totalPracticeTime / 60).toFixed(1)}h</div>
                    <div className="text-xs text-slate-500 uppercase tracking-widest mt-1">總練習時間</div>
                </div>
            </div>
        </div>
    );
}

export default PracticeAnalytics;
