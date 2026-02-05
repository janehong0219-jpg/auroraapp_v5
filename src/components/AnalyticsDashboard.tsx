/**
 * 完整練習分析 Dashboard
 * 整合成長曲線和優化報告
 */

import { useState, useEffect } from 'react';
import { PracticeAnalytics } from './PracticeAnalytics';
import { OptimizationReport } from './OptimizationReport';
import type { PracticeSession } from '../utils/generatePracticeData';
import { exportToJSON } from '../utils/generatePracticeData';
import {
    uploadPracticeSessionsLocal,
    fetchPracticeSessionsLocal,
    clearAllSessionsLocal
} from '../services/PracticeSessionServiceLocal';

interface AnalyticsDashboardProps {
    onClose?: () => void;
}

export function AnalyticsDashboard({ onClose }: AnalyticsDashboardProps) {
    const [sessions, setSessions] = useState<PracticeSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'analytics' | 'report'>('analytics');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // 載入數據
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await fetchPracticeSessionsLocal(5000); // 使用本地存儲
            setSessions(data);
        } catch (error) {
            console.error('載入失敗:', error);
        } finally {
            setLoading(false);
        }
    };

    // 生成並儲存測試數據到本地
    const handleGenerateAndUpload = async () => {
        const message = '即將生成並儲存測試數據到本地：\n\n' +
            '• 50筆練習紀錄\n' +
            '• 數據儲存在瀏覽器本地\n' +
            '• 不需要網路連線\n\n' +
            '約需5-10秒，確定要繼續嗎？';

        if (!confirm(message)) {
            return;
        }

        try {
            setUploading(true);
            setUploadProgress(0);

            // 生成50筆簡單假數據（不導入任何東西）
            console.log('🎵 生成50筆測試數據...');
            const testSessions = [];

            for (let i = 0; i < 50; i++) {
                const progress = i / 50;
                const score = 40 + (50 * progress);

                testSessions.push({
                    id: `test_${i + 1}`,
                    timestamp: Date.now() - (50 - i) * 24 * 60 * 60 * 1000,
                    duration: 30,
                    instrument: 'flute',
                    pitchAccuracy: {
                        averageDeviation: 10 - score / 10,
                        stability: 9 - score / 11,
                        inTunePercentage: score * 0.9
                    },
                    toneQuality: {
                        harmonicsScore: score * 0.95,
                        spectralCentroid: 1100,
                        consistency: score * 0.88
                    },
                    postureMetrics: {
                        embouchureCorrectness: score * 0.93,
                        shoulderBalance: score * 0.96,
                        overallPosture: score * 0.9
                    },
                    practiceType: 'long_tone',
                    overallScore: Math.round(score * 10) / 10
                });

                setUploadProgress((i / 50) * 50);
            }

            console.log(`📊 總計 ${testSessions.length} 筆測試數據`);

            // 儲存到 LocalStorage（本地存儲，不需要網路）
            // 修正類型不匹配問題：確保 instrument 被視為 InstrumentType，並確保整體類型符合 PracticeSession
            const validSessions = testSessions.map(session => ({
                ...session,
                instrument: session.instrument as any, // 強制轉型以避免字串/枚舉類型衝突
                practiceType: session.practiceType as any // 確保練習類型也被正確視為枚舉
            }));

            await uploadPracticeSessionsLocal(validSessions as any[], 10, (uploaded, total) => {
                setUploadProgress(50 + (uploaded / total) * 50);
            });

            // 重新載入
            await loadData();

            alert(`✅ 成功儲存 ${testSessions.length} 筆測試數據到本地！`);
        } catch (error) {
            console.error('上傳失敗:', error);
            alert('❌ 上傳失敗：' + (error as Error).message);
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    // 清除所有數據
    const handleClearData = async () => {
        if (!confirm('⚠️ 警告：這將刪除所有練習數據，此操作無法復原！確定要繼續嗎？')) {
            return;
        }

        try {
            setLoading(true);
            await clearAllSessionsLocal(); // 使用本地存儲
            setSessions([]);
            alert('✅ 已清除所有本地數據');
        } catch (error) {
            console.error('清除失敗:', error);
            alert('❌ 清除失敗');
        } finally {
            setLoading(false);
        }
    };

    // 導出為 JSON
    const handleExportJSON = () => {
        if (sessions.length === 0) {
            alert('沒有數據可導出');
            return;
        }

        const json = exportToJSON(sessions);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `practice-data-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading && sessions.length === 0) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600 font-medium">載入中...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* 頂部工具列 */}
                <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-black bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">
                            🎓 練習分析中心
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">
                            {sessions.length > 0 ? `已載入 ${sessions.length} 筆練習紀錄` : '尚無練習紀錄'}
                        </p>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                        {sessions.length === 0 && (
                            <button
                                onClick={handleGenerateAndUpload}
                                disabled={uploading}
                                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-full text-sm font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {uploading ? `儲存中 ${uploadProgress.toFixed(0)}%` : '📊 生成本地數據'}
                            </button>
                        )}

                        {sessions.length > 0 && (
                            <>
                                <button
                                    onClick={handleExportJSON}
                                    className="px-4 py-2 bg-white/50 hover:bg-white/80 border border-slate-200 text-slate-600 rounded-full text-sm font-semibold transition-all"
                                >
                                    📥 匯出 JSON
                                </button>
                                <button
                                    onClick={handleClearData}
                                    className="px-4 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-full text-sm font-semibold transition-all"
                                >
                                    🗑️ 清除數據
                                </button>
                            </>
                        )}

                        {onClose && (
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-sm font-semibold transition-all"
                            >
                                ✕ 關閉
                            </button>
                        )}
                    </div>
                </div>

                {/* 標籤切換 */}
                {sessions.length > 0 && (
                    <div className="mb-6 flex bg-white/40 backdrop-blur-xl border border-white/40 rounded-full p-1 w-fit">
                        <button
                            onClick={() => setActiveTab('analytics')}
                            className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${activeTab === 'analytics'
                                ? 'bg-white shadow-sm text-slate-700'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            📊 成長曲線
                        </button>
                        <button
                            onClick={() => setActiveTab('report')}
                            className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${activeTab === 'report'
                                ? 'bg-white shadow-sm text-slate-700'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            💡 優化報告
                        </button>
                    </div>
                )}

                {/* 內容區域 */}
                {sessions.length === 0 ? (
                    <div className="bg-white/40 backdrop-blur-xl border border-white/40 rounded-[2.5rem] p-12 text-center">
                        <div className="text-6xl mb-4">🎵</div>
                        <h2 className="text-2xl font-bold text-slate-700 mb-2">尚無練習數據</h2>
                        <p className="text-slate-500 mb-6">
                            點擊「生成本地數據」建立50筆測試數據<br />
                            （數據儲存在瀏覽器本地，不需要網路）
                        </p>
                    </div>
                ) : (
                    <div className="bg-white/20 backdrop-blur-xl border border-white/40 rounded-[2.5rem] p-6 md:p-8 shadow-lg">
                        {activeTab === 'analytics' ? (
                            <PracticeAnalytics />
                        ) : (
                            <OptimizationReport sessions={sessions} />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default AnalyticsDashboard;
