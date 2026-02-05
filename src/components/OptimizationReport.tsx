/**
 * 優化報告組件 - AI 分析和建議
 */

import { useMemo } from 'react';
import type { PracticeSession } from '../utils/generatePracticeData';
import { calculateStatistics } from '../utils/generatePracticeData';

interface OptimizationReportProps {
    sessions: PracticeSession[];
}

interface Milestone {
    score: number;
    sessionNumber: number;
    date: Date;
    label: string;
    icon: string;
}

export function OptimizationReport({ sessions }: OptimizationReportProps) {
    // 計算統計數據
    const stats = useMemo(() => {
        if (sessions.length === 0) return null;
        return calculateStatistics(sessions);
    }, [sessions]);

    // 識別強項和弱項
    const strengths = useMemo(() => {
        if (!stats) return null;

        const metrics = [
            { name: '音準', score: stats.avgPitchAccuracy, key: 'pitch' },
            { name: '音色', score: stats.avgToneQuality, key: 'tone' },
            { name: '姿勢', score: stats.avgPosture, key: 'posture' }
        ];

        metrics.sort((a, b) => b.score - a.score);

        return {
            strongest: metrics[0],
            weakest: metrics[2]
        };
    }, [stats]);

    // 分析進步速度
    const progressAnalysis = useMemo(() => {
        if (sessions.length < 20) return null;

        const first20 = sessions.slice(0, 20);
        const last20 = sessions.slice(-20);

        const avgFirst = first20.reduce((sum, s) => sum + s.overallScore, 0) / 20;
        const avgLast = last20.reduce((sum, s) => sum + s.overallScore, 0) / 20;

        const improvement = avgLast - avgFirst;
        const improvementRate = (improvement / avgFirst) * 100;

        let speed: '極快' | '快' | '中等' | '緩慢' | '停滯';
        if (improvementRate > 50) speed = '極快';
        else if (improvementRate > 30) speed = '快';
        else if (improvementRate > 15) speed = '中等';
        else if (improvementRate > 5) speed = '緩慢';
        else speed = '停滯';

        return { avgFirst, avgLast, improvement, improvementRate, speed };
    }, [sessions]);

    // 分析練習類型效果
    const practiceTypeAnalysis = useMemo(() => {
        if (!stats) return null;

        const typeScores: Record<string, { total: number; count: number }> = {
            'scale': { total: 0, count: 0 },
            'long_tone': { total: 0, count: 0 },
            'piece': { total: 0, count: 0 },
            'technical': { total: 0, count: 0 },
            'mixed': { total: 0, count: 0 }
        };

        sessions.forEach(s => {
            typeScores[s.practiceType].total += s.overallScore;
            typeScores[s.practiceType].count++;
        });

        const typeAverages = Object.entries(typeScores)
            .map(([type, data]) => ({
                type,
                average: data.count > 0 ? data.total / data.count : 0,
                count: data.count
            }))
            .filter(item => item.count > 0)
            .sort((a, b) => b.average - a.average);

        return typeAverages;
    }, [sessions, stats]);

    // 時間分配分析
    const timeAnalysis = useMemo(() => {
        if (sessions.length === 0) return null;

        // 按練習時長分組
        const shortSessions = sessions.filter(s => s.duration < 20);
        const mediumSessions = sessions.filter(s => s.duration >= 20 && s.duration < 35);
        const longSessions = sessions.filter(s => s.duration >= 35);

        const avgScoreShort = shortSessions.length > 0
            ? shortSessions.reduce((sum, s) => sum + s.overallScore, 0) / shortSessions.length
            : 0;
        const avgScoreMedium = mediumSessions.length > 0
            ? mediumSessions.reduce((sum, s) => sum + s.overallScore, 0) / mediumSessions.length
            : 0;
        const avgScoreLong = longSessions.length > 0
            ? longSessions.reduce((sum, s) => sum + s.overallScore, 0) / longSessions.length
            : 0;

        const bestDuration = Math.max(avgScoreShort, avgScoreMedium, avgScoreLong);
        let recommendation: string;

        if (bestDuration === avgScoreLong) {
            recommendation = '35 分鐘以上';
        } else if (bestDuration === avgScoreMedium) {
            recommendation = '20-35 分鐘';
        } else {
            recommendation = '20 分鐘以下';
        }

        return { recommendation, avgScoreShort, avgScoreMedium, avgScoreLong };
    }, [sessions]);

    // 成就里程碑
    const milestones = useMemo(() => {
        const achievements: Milestone[] = [];

        sessions.forEach((session, index) => {
            if (index > 0) {
                const prevBest = Math.max(...sessions.slice(0, index).map(s => s.overallScore));

                if (session.overallScore >= 60 && prevBest < 60) {
                    achievements.push({
                        score: 60,
                        sessionNumber: index + 1,
                        date: new Date(session.timestamp),
                        label: '及格',
                        icon: '✅'
                    });
                }
                if (session.overallScore >= 80 && prevBest < 80) {
                    achievements.push({
                        score: 80,
                        sessionNumber: index + 1,
                        date: new Date(session.timestamp),
                        label: '優秀',
                        icon: '⭐'
                    });
                }
                if (session.overallScore >= 90 && prevBest < 90) {
                    achievements.push({
                        score: 90,
                        sessionNumber: index + 1,
                        date: new Date(session.timestamp),
                        label: '卓越',
                        icon: '🏆'
                    });
                }
            }
        });

        return achievements;
    }, [sessions]);

    // 生成優化建議
    const recommendations = useMemo(() => {
        const suggestions: string[] = [];

        if (!stats || !strengths) return suggestions;

        // 基於弱項提供建議
        if (strengths.weakest.key === 'pitch') {
            suggestions.push('增加長音練習，每次至少 15 分鐘');
            suggestions.push('使用節拍器訓練音準穩定性');
            suggestions.push('練習音階時特別注意每個音的準確度');
        } else if (strengths.weakest.key === 'tone') {
            suggestions.push('注意口腔開合程度（含蛋原理）');
            suggestions.push('調整氣流速度和方向');
            suggestions.push('放鬆嘴唇和喉嚨，避免過度緊張');
        } else {
            suggestions.push('對著鏡子練習，檢查嘴型和肩膀姿勢');
            suggestions.push('確保肩膀保持水平，避免單側過高');
            suggestions.push('練習時保持身體放鬆，避免過度用力');
        }

        // 基於練習頻率提供建議
        if (stats.totalSessions < 50) {
            suggestions.push('建議每週至少練習 4 次，保持學習動力');
        } else if (stats.totalSessions > 80) {
            suggestions.push('練習量充足！繼續保持規律練習');
        }

        // 基於練習時長提供建議
        if (timeAnalysis && timeAnalysis.recommendation.includes('35')) {
            suggestions.push(`每次練習 ${timeAnalysis.recommendation} 效果最佳`);
        }

        // 基於練習類型提供建議
        if (practiceTypeAnalysis && practiceTypeAnalysis.length > 0) {
            const best = practiceTypeAnalysis[0];
            const typeNames: Record<string, string> = {
                'long_tone': '長音練習',
                'scale': '音階練習',
                'technical': '技巧練習',
                'piece': '曲目練習',
                'mixed': '混合練習'
            };
            suggestions.push(`${typeNames[best.type]}對您最有效，可以適度增加這類練習`);
        }

        return suggestions;
    }, [stats, strengths, timeAnalysis, practiceTypeAnalysis]);

    if (!stats || sessions.length === 0) {
        return (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center">
                <p className="text-slate-600">需要至少 10 次練習才能生成優化報告</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 標題 */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-700 mb-2">💡 練習優化報告</h2>
                <p className="text-sm text-slate-500">AI 分析您的練習數據，提供個性化建議</p>
            </div>

            {/* 整體進步 */}
            <div className="bg-gradient-to-br from-emerald-50 to-cyan-50 border border-emerald-200 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-emerald-700 mb-4 flex items-center gap-2">
                    <span>📈</span> 整體進步
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                        <div className="text-sm text-slate-600 mb-1">起始分數</div>
                        <div className="text-2xl font-black text-red-500">
                            {progressAnalysis ? progressAnalysis.avgFirst.toFixed(1) : stats.minScore}
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-slate-600 mb-1">當前分數</div>
                        <div className="text-2xl font-black text-green-500">
                            {progressAnalysis ? progressAnalysis.avgLast.toFixed(1) : stats.maxScore}
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-slate-600 mb-1">總進步</div>
                        <div className="text-2xl font-black text-cyan-600">
                            +{progressAnalysis ? progressAnalysis.improvement.toFixed(1) : (stats.maxScore - stats.minScore).toFixed(1)}
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-slate-600 mb-1">進步速度</div>
                        <div className="text-2xl font-black text-purple-600">
                            {progressAnalysis?.speed || '中等'}
                        </div>
                    </div>
                </div>
            </div>

            {/* 強項與弱項 */}
            {strengths && (
                <div className="bg-white/40 backdrop-blur-xl border border-white/40 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <span>🎯</span> 強項與弱項
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                            <div className="text-sm text-green-600 font-semibold mb-2 flex items-center gap-2">
                                <span>✅</span> 強項
                            </div>
                            <div className="font-bold text-lg text-green-700">{strengths.strongest.name}</div>
                            <div className="text-2xl font-black text-green-600 mt-1">{strengths.strongest.score.toFixed(1)}/100</div>
                        </div>
                        <div className="bg-amber-50 borderbordered-amber-200 rounded-xl p-4">
                            <div className="text-sm text-amber-600 font-semibold mb-2 flex items-center gap-2">
                                <span>⚠️</span> 需加強
                            </div>
                            <div className="font-bold text-lg text-amber-700">{strengths.weakest.name}</div>
                            <div className="text-2xl font-black text-amber-600 mt-1">{strengths.weakest.score.toFixed(1)}/100</div>
                        </div>
                    </div>
                </div>
            )}

            {/* 練習類型效果 */}
            {practiceTypeAnalysis && practiceTypeAnalysis.length > 0 && (
                <div className="bg-white/40 backdrop-blur-xl border border-white/40 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <span>🎼</span> 練習類型效果
                    </h3>
                    <div className="space-y-3">
                        {practiceTypeAnalysis.map((item, index) => {
                            const typeNames: Record<string, string> = {
                                'long_tone': '🎵 長音練習',
                                'scale': '🎹 音階練習',
                                'technical': '🎸 技巧練習',
                                'piece': '🎼 曲目練習',
                                'mixed': '🎭 混合練習'
                            };

                            return (
                                <div key={item.type} className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm font-semibold text-slate-700">{typeNames[item.type]}</span>
                                            <span className="text-sm font-bold text-slate-600">{item.average.toFixed(1)}</span>
                                        </div>
                                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${index === 0 ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-slate-400 to-slate-500'}`}
                                                style={{ width: `${item.average}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-500">{item.count}次</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 成就里程碑 */}
            {milestones.length > 0 && (
                <div className="bg-white/40 backdrop-blur-xl border border-white/40 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <span>🏅</span> 成就里程碑
                    </h3>
                    <div className="space-y-3">
                        {milestones.map((milestone, index) => (
                            <div key={index} className="flex items-center gap-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
                                <div className="text-3xl">{milestone.icon}</div>
                                <div className="flex-1">
                                    <div className="font-bold text-slate-700">{milestone.label} ({milestone.score} 分)</div>
                                    <div className="text-sm text-slate-500">
                                        第 {milestone.sessionNumber} 次練習 • {milestone.date.toLocaleDateString('zh-TW')}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 優化建議 */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-blue-700 mb-4 flex items-center gap-2">
                    <span>💡</span> 優化建議
                </h3>
                <div className="space-y-3">
                    {recommendations.map((suggestion, index) => (
                        <div key={index} className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                                {index + 1}
                            </div>
                            <p className="text-slate-700 text-sm leading-relaxed">{suggestion}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default OptimizationReport;
