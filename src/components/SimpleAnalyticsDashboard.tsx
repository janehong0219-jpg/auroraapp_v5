/**
 * 簡化版練習分析 Dashboard
 * 完全獨立，不依賴其他組件，避免崩潰
 */

import { useState, useEffect } from 'react';

interface SimplePracticeSession {
    id: string;
    timestamp: number;
    duration: number;
    instrument: string;
    overallScore: number;
    pitchScore: number;
    toneScore: number;
    postureScore: number;
}

interface SimpleAnalyticsDashboardProps {
    onClose?: () => void;
}

const STORAGE_KEY = 'aurora_simple_practice_sessions';

// 簡單的本地存儲函數
function saveSessionsToLocal(sessions: SimplePracticeSession[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
        console.log(`✅ 已儲存 ${sessions.length} 筆數據到本地`);
    } catch (e) {
        console.error('儲存失敗:', e);
    }
}

function loadSessionsFromLocal(): SimplePracticeSession[] {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];
        return JSON.parse(data);
    } catch (e) {
        console.error('讀取失敗:', e);
        return [];
    }
}

function clearLocalSessions() {
    localStorage.removeItem(STORAGE_KEY);
    console.log('✅ 已清除所有本地數據');
}

export function SimpleAnalyticsDashboard({ onClose }: SimpleAnalyticsDashboardProps) {
    const [sessions, setSessions] = useState<SimplePracticeSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [progress, setProgress] = useState(0);

    // 載入數據
    useEffect(() => {
        setLoading(true);
        const data = loadSessionsFromLocal();
        setSessions(data);
        setLoading(false);
    }, []);

    // 生成測試數據
    const handleGenerate = () => {
        if (!confirm('即將生成 50 筆測試數據，確定嗎？')) return;

        setGenerating(true);
        setProgress(0);

        const newSessions: SimplePracticeSession[] = [];
        const now = Date.now();

        for (let i = 0; i < 50; i++) {
            const dayOffset = 50 - i;
            const progressRatio = i / 50;
            const baseScore = 40 + (50 * progressRatio);

            newSessions.push({
                id: `session_${i + 1}`,
                timestamp: now - (dayOffset * 24 * 60 * 60 * 1000),
                duration: 30,
                instrument: 'flute',
                overallScore: Math.round(baseScore * 10) / 10,
                pitchScore: Math.round(baseScore * 0.9 * 10) / 10,
                toneScore: Math.round(baseScore * 0.95 * 10) / 10,
                postureScore: Math.round(baseScore * 0.92 * 10) / 10
            });

            setProgress((i / 50) * 100);
        }

        // 儲存到本地
        saveSessionsToLocal(newSessions);
        setSessions(newSessions);
        setGenerating(false);
        setProgress(100);

        alert(`✅ 成功生成 ${newSessions.length} 筆練習數據！`);
    };

    // 清除數據
    const handleClear = () => {
        if (!confirm('確定要刪除所有數據嗎？')) return;
        clearLocalSessions();
        setSessions([]);
        alert('✅ 已清除所有數據');
    };

    // 計算統計
    const stats = sessions.length > 0 ? {
        count: sessions.length,
        avgScore: Math.round(sessions.reduce((sum, s) => sum + s.overallScore, 0) / sessions.length * 10) / 10,
        firstScore: sessions[0]?.overallScore || 0,
        lastScore: sessions[sessions.length - 1]?.overallScore || 0,
        improvement: Math.round((sessions[sessions.length - 1]?.overallScore - sessions[0]?.overallScore) * 10) / 10,
        totalTime: sessions.reduce((sum, s) => sum + s.duration, 0)
    } : null;

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">載入中...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-6">
            <div className="max-w-4xl mx-auto">
                {/* 標題 */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-black bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">
                            📊 練習分析中心
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">
                            {sessions.length > 0 ? `已載入 ${sessions.length} 筆練習紀錄` : '尚無練習紀錄'}
                        </p>
                    </div>

                    <div className="flex gap-2">
                        {sessions.length === 0 && (
                            <button
                                onClick={handleGenerate}
                                disabled={generating}
                                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-full text-sm font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                            >
                                {generating ? `生成中 ${progress.toFixed(0)}%` : '📊 生成測試數據'}
                            </button>
                        )}

                        {sessions.length > 0 && (
                            <button
                                onClick={handleClear}
                                className="px-4 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-full text-sm font-semibold"
                            >
                                🗑️ 清除數據
                            </button>
                        )}

                        {onClose && (
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-sm font-semibold"
                            >
                                ✕ 關閉
                            </button>
                        )}
                    </div>
                </div>

                {/* 無數據狀態 */}
                {sessions.length === 0 && (
                    <div className="bg-white/60 backdrop-blur-xl border border-white/40 rounded-3xl p-12 text-center">
                        <div className="text-6xl mb-4">🎵</div>
                        <h2 className="text-2xl font-bold text-slate-700 mb-2">尚無練習數據</h2>
                        <p className="text-slate-500">
                            點擊「生成測試數據」建立 50 筆練習紀錄
                        </p>
                    </div>
                )}

                {/* 有數據狀態 */}
                {sessions.length > 0 && stats && (
                    <>
                        {/* 統計卡片 */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl p-4 text-center">
                                <div className="text-3xl font-black text-emerald-600">{stats.count}</div>
                                <div className="text-sm text-slate-500">總練習次數</div>
                            </div>
                            <div className="bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl p-4 text-center">
                                <div className="text-3xl font-black text-blue-600">{stats.avgScore}</div>
                                <div className="text-sm text-slate-500">平均分數</div>
                            </div>
                            <div className="bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl p-4 text-center">
                                <div className={`text-3xl font-black ${stats.improvement > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {stats.improvement > 0 ? '+' : ''}{stats.improvement}
                                </div>
                                <div className="text-sm text-slate-500">進步幅度</div>
                            </div>
                            <div className="bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl p-4 text-center">
                                <div className="text-3xl font-black text-purple-600">{Math.round(stats.totalTime / 60)}h</div>
                                <div className="text-sm text-slate-500">總練習時間</div>
                            </div>
                        </div>

                        {/* 成長曲線 */}
                        <div className="bg-white/60 backdrop-blur-xl border border-white/40 rounded-3xl p-6 mb-6">
                            <h3 className="text-xl font-bold text-slate-700 mb-4">📈 成長曲線</h3>

                            {/* 簡單的 SVG 圖表 */}
                            <div className="w-full h-64 bg-slate-50 rounded-2xl p-4 overflow-hidden">
                                <svg className="w-full h-full" viewBox="0 0 500 200" preserveAspectRatio="none">
                                    {/* 網格線 */}
                                    <line x1="0" y1="50" x2="500" y2="50" stroke="#e2e8f0" strokeWidth="1" />
                                    <line x1="0" y1="100" x2="500" y2="100" stroke="#e2e8f0" strokeWidth="1" />
                                    <line x1="0" y1="150" x2="500" y2="150" stroke="#e2e8f0" strokeWidth="1" />

                                    {/* 數據曲線 */}
                                    <polyline
                                        fill="none"
                                        stroke="url(#gradient)"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        points={sessions.map((s, i) => {
                                            const x = (i / (sessions.length - 1)) * 480 + 10;
                                            const y = 200 - (s.overallScore / 100) * 180;
                                            return `${x},${y}`;
                                        }).join(' ')}
                                    />

                                    {/* 漸層定義 */}
                                    <defs>
                                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#10b981" />
                                            <stop offset="100%" stopColor="#06b6d4" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>

                            <div className="flex justify-between text-sm text-slate-500 mt-2">
                                <span>第 1 天: {stats.firstScore} 分</span>
                                <span>第 {sessions.length} 天: {stats.lastScore} 分</span>
                            </div>
                        </div>

                        {/* 分析報告 */}
                        <div className="bg-white/60 backdrop-blur-xl border border-white/40 rounded-3xl p-6">
                            <h3 className="text-xl font-bold text-slate-700 mb-4">💡 分析報告</h3>

                            <div className="space-y-4">
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                                    <h4 className="font-bold text-emerald-700 mb-2">📈 整體進步</h4>
                                    <p className="text-emerald-600">
                                        經過 {sessions.length} 次練習，你的分數從 {stats.firstScore} 分提升到 {stats.lastScore} 分，
                                        進步了 {stats.improvement} 分！
                                    </p>
                                </div>

                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                    <h4 className="font-bold text-blue-700 mb-2">🎯 練習建議</h4>
                                    <ul className="text-blue-600 space-y-1">
                                        <li>• 保持每天練習的習慣，持續進步</li>
                                        <li>• 專注於音準訓練，這是基礎中的基礎</li>
                                        <li>• 嘗試增加練習時長到 45 分鐘</li>
                                        <li>• 定期回顧自己的進步，保持動力</li>
                                    </ul>
                                </div>

                                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                                    <h4 className="font-bold text-purple-700 mb-2">🏆 成就</h4>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                                            🔥 連續練習 {sessions.length} 天
                                        </span>
                                        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                                            📈 進步 {stats.improvement} 分
                                        </span>
                                        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                                            ⏱️ 累計 {stats.totalTime} 分鐘
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default SimpleAnalyticsDashboard;
