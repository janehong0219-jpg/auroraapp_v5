/**
 * 簡化的測試數據生成器
 * 只生成500筆數據作為測試
 */

import type { InstrumentType } from './InstrumentConfig';
import type { PracticeSession } from './generatePracticeData';

/**
 * 生成500筆測試數據（優化版）
 */
export async function generateTestData(
    onProgress?: (generated: number, total: number) => void
): Promise<PracticeSession[]> {
    const sessions: PracticeSession[] = [];
    const totalSessions = 500; // 固定生成500筆
    const instrument: InstrumentType = 'flute';

    console.log('🎵 開始生成500筆測試數據...');

    const now = Date.now();
    const startTime = now - (180 * 24 * 60 * 60 * 1000); // 往前推180天

    for (let i = 0; i < totalSessions; i++) {
        // 計算時間戳（均勻分佈在180天內）
        const timestamp = startTime + (i / totalSessions) * (180 * 24 * 60 * 60 * 1000);

        // 計算進度（0-1）
        const progress = i / totalSessions;

        // 基礎分數：從40分進步到90分
        const baseScore = 40 + (50 * progress);

        // 添加隨機波動 ±5分
        const variation = (Math.random() - 0.5) * 10;
        const overallScore = Math.max(20, Math.min(98, baseScore + variation));

        // 生成session
        const session: PracticeSession = {
            id: `test_${String(i + 1).padStart(5, '0')}`,
            timestamp: timestamp + (Math.random() * 8 * 60 * 60 * 1000), // 隨機時間
            duration: Math.round(20 + Math.random() * 20), // 20-40分鐘
            instrument,
            pitchAccuracy: {
                averageDeviation: Math.max(0.5, 10 - (overallScore / 10)),
                stability: Math.max(1, 9 - (overallScore / 11)),
                inTunePercentage: Math.min(99, overallScore * 0.9)
            },
            toneQuality: {
                harmonicsScore: Math.min(99, overallScore * 0.95),
                spectralCentroid: 1000 + Math.random() * 200,
                consistency: Math.min(97, overallScore * 0.88)
            },
            postureMetrics: {
                embouchureCorrectness: Math.min(99, overallScore * 0.93),
                shoulderBalance: Math.min(99, overallScore * 0.96),
                overallPosture: Math.min(98, overallScore * 0.9)
            },
            practiceType: ['long_tone', 'scale', 'technical', 'piece', 'mixed'][Math.floor(Math.random() * 5)] as any,
            overallScore: Math.round(overallScore * 10) / 10
        };

        sessions.push(session);

        // 每100筆報告一次進度
        if ((i + 1) % 100 === 0 || i === totalSessions - 1) {
            if (onProgress) {
                onProgress(i + 1, totalSessions);
            }
            console.log(`進度: ${i + 1}/${totalSessions}`);

            // 讓瀏覽器喘息
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    console.log(`✅ 生成了 ${sessions.length} 筆測試數據`);
    return sessions;
}
