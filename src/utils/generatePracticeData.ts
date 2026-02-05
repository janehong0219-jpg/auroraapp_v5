/**
 * 練習數據生成器
 * 生成 100 筆模擬練習數據，符合真實成長曲線
 */

import type { InstrumentType } from './InstrumentConfig';

export interface PracticeSession {
    id: string;
    timestamp: number;
    duration: number;                    // 練習時長（分鐘）
    instrument: InstrumentType;

    // 音準數據
    pitchAccuracy: {
        averageDeviation: number;        // 平均音準偏差（cents）
        stability: number;               // 音準穩定性（0-10，越低越好）
        inTunePercentage: number;        // 在正確音準的時間百分比
    };

    // 音色數據
    toneQuality: {
        harmonicsScore: number;          // 共鳴度（0-100%）
        spectralCentroid: number;        // 頻譜質心（Hz）
        consistency: number;             // 音色一致性（0-100%）
    };

    // 姿勢數據
    postureMetrics: {
        embouchureCorrectness: number;   // 嘴型正確度（0-100%）
        shoulderBalance: number;         // 肩膀平衡度（0-100%）
        overallPosture: number;          // 整體姿勢分數（0-100%）
    };

    // 練習類型
    practiceType: 'scale' | 'long_tone' | 'piece' | 'technical' | 'mixed';

    // 整體評分
    overallScore: number;                // 綜合評分（0-100）

    // 練習筆記（可選）
    notes?: string;
}

/**
 * 生成隨機數（正態分佈）
 */
function randomNormal(mean: number, stdDev: number): number {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z0 * stdDev;
}

/**
 * 限制數值範圍
 */
function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * 計算成長因子（模擬學習曲線）
 * 前期進步快，後期趨緩
 */
function getGrowthFactor(sessionNumber: number, totalSessions: number): number {
    const progress = sessionNumber / totalSessions;

    // 使用對數曲線模擬學習曲線
    // y = a * ln(x + 1) + b
    const a = 25;
    const b = 10;
    const growthBase = a * Math.log(progress * 10 + 1) + b;

    // 添加階段性變化
    let stageFactor = 1.0;

    if (sessionNumber <= 20) {
        // 初學階段：進步快但不穩定
        stageFactor = 1.2;
    } else if (sessionNumber <= 50) {
        // 中級階段：穩定進步
        stageFactor = 1.0;
    } else if (sessionNumber <= 80) {
        // 瓶頸期：進步趨緩
        stageFactor = 0.7;
    } else {
        // 突破期：顯著提升
        stageFactor = 1.3;
    }

    return growthBase * stageFactor;
}

/**
 * 生成練習類型（根據階段調整分布）
 */
function generatePracticeType(sessionNumber: number): PracticeSession['practiceType'] {
    const types: PracticeSession['practiceType'][] = ['scale', 'long_tone', 'piece', 'technical', 'mixed'];

    // 初學者多練習基礎（scale, long_tone）
    if (sessionNumber <= 30) {
        const basicTypes: PracticeSession['practiceType'][] = ['scale', 'long_tone', 'technical'];
        return basicTypes[Math.floor(Math.random() * basicTypes.length)];
    }

    // 中後期增加曲目練習
    return types[Math.floor(Math.random() * types.length)];
}

/**
 * 獲取練習類型加成
 */
function getPracticeTypeBonus(practiceType: PracticeSession['practiceType']): number {
    const bonuses = {
        'long_tone': 3,      // 長音練習對穩定性幫助大
        'scale': 2,          // 音階練習基礎扎實
        'technical': 1,      // 技巧練習
        'piece': 0,          // 曲目練習（綜合）
        'mixed': 1.5         // 混合練習
    };
    return bonuses[practiceType];
}

/**
 * 生成單筆練習數據
 */
function generateSession(
    sessionNumber: number,
    totalSessions: number,
    instrument: InstrumentType = 'flute'
): PracticeSession {

    const now = Date.now();
    // 模擬過去 100 天的練習（平均每天 1 次）
    const daysAgo = totalSessions - sessionNumber;
    const timestamp = now - (daysAgo * 24 * 60 * 60 * 1000);

    // 練習時長：10-45 分鐘（後期傾向更長）
    const baseDuration = 15 + (sessionNumber / totalSessions) * 20;
    const duration = Math.round(randomNormal(baseDuration, 5));

    // 練習類型
    const practiceType = generatePracticeType(sessionNumber);

    // 成長因子
    const growthFactor = getGrowthFactor(sessionNumber, totalSessions);

    // 練習類型加成
    const typeBonus = getPracticeTypeBonus(practiceType);

    // 基礎分數（起始水平：40-50 分）
    const baseScore = 40 + Math.random() * 10;

    // 隨機波動（±5-10%）
    const randomNoise = randomNormal(0, 5);

    // 偶爾的"特別好"或"特別差"（5% 機率）
    let specialBonus = 0;
    const rand = Math.random();
    if (rand < 0.025) {
        specialBonus = 10;  // 特別好的一次練習
    } else if (rand < 0.05) {
        specialBonus = -8;  // 特別差的一次練習
    }

    // 長時間練習加成
    const durationBonus = duration > 30 ? 3 : 0;

    // 計算整體評分
    const overallScore = clamp(
        baseScore + growthFactor + typeBonus + randomNoise + specialBonus + durationBonus,
        20, 98  // 最低 20，最高 98（保持真實感）
    );

    // 音準數據（與整體分數相關）
    const pitchBase = overallScore * 0.8 + randomNormal(0, 5);
    const pitchAccuracy = {
        averageDeviation: clamp(15 - (pitchBase / 10), 1, 15),  // cents，越低越好
        stability: clamp(10 - (pitchBase / 10), 1, 10),         // 0-10，越低越好
        inTunePercentage: clamp(pitchBase * 0.9, 30, 98)        // 百分比
    };

    // 音色數據
    const toneBase = overallScore * 0.85 + randomNormal(0, 5);
    const toneQuality = {
        harmonicsScore: clamp(toneBase * 0.9, 30, 98),
        spectralCentroid: clamp(1200 - (toneBase * 3), 800, 1800),  // 理想範圍 800-1500
        consistency: clamp(toneBase * 0.85, 40, 95)
    };

    // 姿勢數據
    const postureBase = overallScore * 0.9 + randomNormal(0, 5);
    const postureMetrics = {
        embouchureCorrectness: clamp(postureBase * 0.9, 35, 98),
        shoulderBalance: clamp(postureBase * 0.95, 40, 98),
        overallPosture: clamp(postureBase * 0.88, 35, 98)
    };

    // 練習筆記（偶爾添加）
    let notes: string | undefined;
    if (Math.random() < 0.15) {  // 15% 機率有筆記
        const noteTemplates = [
            '今天感覺不錯，音色有進步',
            '音準還需要加強',
            '長音練習很有幫助',
            '嘴型調整後音色改善明顯',
            '需要更多練習穩定性',
            '突破瓶頸！',
            '狀態不佳，明天再試',
            '老師建議多練音階'
        ];
        notes = noteTemplates[Math.floor(Math.random() * noteTemplates.length)];
    }

    return {
        id: `session_${String(sessionNumber).padStart(3, '0')}`,
        timestamp,
        duration: clamp(duration, 10, 60),
        instrument,
        pitchAccuracy,
        toneQuality,
        postureMetrics,
        practiceType,
        overallScore: Math.round(overallScore * 10) / 10,  // 保留一位小數
        notes
    };
}

/**
 * 生成完整的練習數據集（100 筆）
 */
export function generatePracticeData(
    count: number = 100,
    instrument: InstrumentType = 'flute'
): PracticeSession[] {
    const sessions: PracticeSession[] = [];

    for (let i = 1; i <= count; i++) {
        sessions.push(generateSession(i, count, instrument));
    }

    return sessions;
}

/**
 * 計算統計數據
 */
export interface PracticeStatistics {
    totalSessions: number;
    averageScore: number;
    maxScore: number;
    minScore: number;
    improvementRate: number;          // 進步率（%）
    averageDuration: number;
    totalPracticeTime: number;        // 總練習時間（分鐘）

    // 分項平均
    avgPitchAccuracy: number;
    avgToneQuality: number;
    avgPosture: number;

    // 練習類型分布
    practiceTypeDistribution: Record<PracticeSession['practiceType'], number>;
}

export function calculateStatistics(sessions: PracticeSession[]): PracticeStatistics {
    if (sessions.length === 0) {
        throw new Error('No sessions to analyze');
    }

    const scores = sessions.map(s => s.overallScore);
    const totalSessions = sessions.length;
    const averageScore = scores.reduce((a, b) => a + b) / totalSessions;
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);

    // 進步率：(最後10次平均 - 最初10次平均) / 最初10次平均 * 100
    const first10 = scores.slice(0, 10).reduce((a, b) => a + b) / 10;
    const last10 = scores.slice(-10).reduce((a, b) => a + b) / 10;
    const improvementRate = ((last10 - first10) / first10) * 100;

    const totalPracticeTime = sessions.reduce((sum, s) => sum + s.duration, 0);
    const averageDuration = totalPracticeTime / totalSessions;

    // 分項平均
    const avgPitchAccuracy = sessions.reduce((sum, s) => sum + s.pitchAccuracy.inTunePercentage, 0) / totalSessions;
    const avgToneQuality = sessions.reduce((sum, s) => sum + s.toneQuality.harmonicsScore, 0) / totalSessions;
    const avgPosture = sessions.reduce((sum, s) => sum + s.postureMetrics.overallPosture, 0) / totalSessions;

    // 練習類型分布
    const practiceTypeDistribution: Record<PracticeSession['practiceType'], number> = {
        scale: 0,
        long_tone: 0,
        piece: 0,
        technical: 0,
        mixed: 0
    };

    sessions.forEach(s => {
        practiceTypeDistribution[s.practiceType]++;
    });

    return {
        totalSessions,
        averageScore: Math.round(averageScore * 10) / 10,
        maxScore,
        minScore,
        improvementRate: Math.round(improvementRate * 10) / 10,
        averageDuration: Math.round(averageDuration * 10) / 10,
        totalPracticeTime,
        avgPitchAccuracy: Math.round(avgPitchAccuracy * 10) / 10,
        avgToneQuality: Math.round(avgToneQuality * 10) / 10,
        avgPosture: Math.round(avgPosture * 10) / 10,
        practiceTypeDistribution
    };
}

/**
 * 導出為 JSON（用於測試或備份）
 */
export function exportToJSON(sessions: PracticeSession[]): string {
    return JSON.stringify({
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
        totalSessions: sessions.length,
        sessions
    }, null, 2);
}

// 可選：命令列測試 (僅在非瀏覽器環境執行)
if (typeof window === 'undefined') {
    // Node.js 環境
    const sessions = generatePracticeData(100);
    const stats = calculateStatistics(sessions);

    console.log('✅ 成功生成 100 筆練習數據');
    console.log('\n📊 統計摘要:');
    console.log(`   總練習次數: ${stats.totalSessions} 次`);
    console.log(`   平均分數: ${stats.averageScore} 分`);
    console.log(`   最高分數: ${stats.maxScore} 分`);
    console.log(`   最低分數: ${stats.minScore} 分`);
    console.log(`   進步率: ${stats.improvementRate}%`);
    console.log(`   總練習時間: ${stats.totalPracticeTime} 分鐘 (${(stats.totalPracticeTime / 60).toFixed(1)} 小時)`);

    console.log('\n📈 分項平均:');
    console.log(`   音準: ${stats.avgPitchAccuracy}/100`);
    console.log(`   音色: ${stats.avgToneQuality}/100`);
    console.log(`   姿勢: ${stats.avgPosture}/100`);

    console.log('\n🎯 練習類型分布:');
    Object.entries(stats.practiceTypeDistribution).forEach(([type, count]) => {
        console.log(`   ${type}: ${count} 次 (${((count / stats.totalSessions) * 100).toFixed(1)}%)`);
    });
}
