/**
 * 超級簡化的測試數據生成器
 * 只生成 100 筆數據，並增加更多延遲避免阻塞
 */

import type { InstrumentType } from './InstrumentConfig';
import type { PracticeSession } from './generatePracticeData';

/**
 * 生成100筆測試數據（超級保守版）
 */
export async function generateMiniTestData(
    onProgress?: (generated: number, total: number) => void
): Promise<PracticeSession[]> {
    const sessions: PracticeSession[] = [];
    const totalSessions = 100; // 只生成100筆
    const instrument: InstrumentType = 'flute';

    console.log('🎵 開始生成100筆測試數據...');

    const now = Date.now();
    const startTime = now - (60 * 24 * 60 * 60 * 1000); // 往前推60天

    // 每10筆就暫停一次，讓瀏覽器喘息
    for (let i = 0; i < totalSessions; i++) {
        // 計算時間戳
        const timestamp = startTime + (i / totalSessions) * (60 * 24 * 60 * 60 * 1000);

        // 計算進度
        const progress = i / totalSessions;

        // 基礎分數
        const baseScore = 40 + (50 * progress);
        const variation = (Math.random() - 0.5) * 10;
        const overallScore = Math.max(20, Math.min(98, baseScore + variation));

        // 生成session
        const session: PracticeSession = {
            id: `mini_${String(i + 1).padStart(3, '0')}`,
            timestamp: timestamp + (Math.random() * 8 * 60 * 60 * 1000),
            duration: Math.round(20 + Math.random() * 20),
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

        // 每10筆報告進度並暫停
        if ((i + 1) % 10 === 0 || i === totalSessions - 1) {
            if (onProgress) {
                onProgress(i + 1, totalSessions);
            }
            console.log(`進度: ${i + 1}/${totalSessions}`);

            // 重要：讓瀏覽器有時間處理其他事情
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }

    console.log(`✅ 生成了 ${sessions.length} 筆測試數據`);
    return sessions;
}
