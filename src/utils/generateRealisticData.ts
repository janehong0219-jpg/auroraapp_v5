/**
 * 真實場景數據生成器 - 5年長笛學習歷程（優化版）
 * 
 * 場景：27歲女生，學習長笛5年
 * 練習頻率：每天3次，每次30分鐘
 * 總練習次數：約5000+次
 * 
 * 優化：分批生成避免阻塞主線程
 */

import type { InstrumentType } from './InstrumentConfig';
import type { PracticeSession } from './generatePracticeData';

/**
 * 生成真實的5年學習數據（優化版，分批生成）
 */
export async function generateRealisticFiveYearData(
    onProgress?: (generated: number, total: number) => void
): Promise<PracticeSession[]> {
    const sessions: PracticeSession[] = [];

    // 參數設定
    const yearsOfPractice = 5;
    const sessionsPerDay = 3;
    const avgDurationMinutes = 30;
    const instrument: InstrumentType = 'flute';

    // 計算時間範圍
    const now = Date.now();
    const fiveYearsInMs = yearsOfPractice * 365 * 24 * 60 * 60 * 1000;
    const startTime = now - fiveYearsInMs;

    // 生成約5年的數據（考慮偶爾休息日）
    const totalDays = yearsOfPractice * 365;
    let sessionId = 1;
    let estimatedTotal = totalDays * 2.7; // 估計總數（考慮休息日）

    console.log(`🎵 開始生成真實5年練習數據...`);

    // 分批生成（每100天一批，避免阻塞）
    const batchSize = 100;
    for (let batchStart = 0; batchStart < totalDays; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, totalDays);

        // 生成這一批數據
        for (let day = batchStart; day < batchEnd; day++) {
            const currentDate = new Date(startTime + (day * 24 * 60 * 60 * 1000));

            // 模擬真實情況：週末可能練習較少，偶爾會休息
            const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
            const skipProbability = isWeekend ? 0.15 : 0.05;

            if (Math.random() < skipProbability) {
                continue; // 這天休息
            }

            // 每天的練習次數
            let dailySessions = sessionsPerDay;
            const rand = Math.random();
            if (rand < 0.1) dailySessions = 2;
            else if (rand > 0.9) dailySessions = 4;

            // 生成這天的練習
            for (let sessionOfDay = 0; sessionOfDay < dailySessions; sessionOfDay++) {
                const session = generateRealisticSession(
                    sessionId,
                    day,
                    totalDays,
                    sessionOfDay,
                    dailySessions,
                    currentDate.getTime(),
                    instrument,
                    avgDurationMinutes
                );

                sessions.push(session);
                sessionId++;
            }
        }

        // 報告進度
        if (onProgress) {
            onProgress(sessions.length, Math.floor(estimatedTotal));
        }

        console.log(`進度: ${batchEnd}/${totalDays} 天 (已生成 ${sessions.length} 筆)`);

        // 讓瀏覽器喘息（避免阻塞 UI）
        if (batchEnd < totalDays) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    console.log(`✅ 生成了 ${sessions.length} 筆真實練習數據（${yearsOfPractice}年）`);
    return sessions;
}

/**
 * 生成單筆真實練習數據
 */
function generateRealisticSession(
    sessionId: number,
    dayNumber: number,
    totalDays: number,
    sessionOfDay: number,
    dailySessions: number,
    timestamp: number,
    instrument: InstrumentType,
    avgDuration: number
): PracticeSession {

    // 學習進度（0-1）
    const progress = dayNumber / totalDays;

    // 基礎分數：從初學40分逐步提升到高級85-95分
    const baseScore = 35 + (55 * Math.log10(progress * 9 + 1));

    // 技能階段
    let skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    if (progress < 0.2) skillLevel = 'beginner';
    else if (progress < 0.5) skillLevel = 'intermediate';
    else if (progress < 0.8) skillLevel = 'advanced';
    else skillLevel = 'expert';

    // 時間分布
    let hourOfDay: number;
    if (sessionOfDay === 0) hourOfDay = 7 + Math.floor(Math.random() * 3);
    else if (sessionOfDay === 1) hourOfDay = 14 + Math.floor(Math.random() * 3);
    else if (sessionOfDay === 2) hourOfDay = 19 + Math.floor(Math.random() * 3);
    else hourOfDay = 12 + Math.floor(Math.random() * 8);

    const sessionTimestamp = timestamp + (hourOfDay * 60 * 60 * 1000);

    // 練習時長
    let duration = avgDuration;
    if (sessionOfDay === 0) {
        duration = avgDuration + randomNormal(5, 3);
    } else if (sessionOfDay === dailySessions - 1) {
        duration = avgDuration - randomNormal(5, 3);
    } else {
        duration = avgDuration + randomNormal(0, 5);
    }
    duration = Math.max(15, Math.min(60, Math.round(duration)));

    // 練習類型
    const practiceType = selectPracticeType(skillLevel);

    // 效果加成
    const typeBonus = getPracticeTypeBonus(practiceType);
    const durationBonus = duration > 35 ? 2 : duration < 20 ? -2 : 0;
    const timeOfDayBonus = sessionOfDay === 0 ? 2 : 0;

    // 波動
    const dailyVariation = randomNormal(0, 3);
    const cycleDays = 28;
    const cyclePosition = (dayNumber % cycleDays) / cycleDays;
    const cycleEffect = -3 * Math.sin(cyclePosition * Math.PI * 2);

    // 進步趨勢
    let progressBonus = 0;
    if (skillLevel === 'intermediate') progressBonus = 5;
    else if (skillLevel === 'advanced') progressBonus = 10;
    else if (skillLevel === 'expert') progressBonus = 15;

    // 偶爾突破或低潮
    let specialEvent = 0;
    const eventRand = Math.random();
    if (eventRand < 0.02) specialEvent = 10;
    else if (eventRand < 0.05) specialEvent = -8;

    // 總分
    const overallScore = clamp(
        baseScore + progressBonus + typeBonus + durationBonus +
        timeOfDayBonus + dailyVariation + cycleEffect + specialEvent,
        20, 98
    );

    // 音準數據
    const pitchBase = overallScore * 0.85 + randomNormal(0, 4);
    const pitchAccuracy = {
        averageDeviation: clamp(12 - (pitchBase / 10), 0.5, 12),
        stability: clamp(9 - (pitchBase / 11), 0.8, 9),
        inTunePercentage: clamp(pitchBase * 0.92, 40, 99)
    };

    // 音色數據
    const toneBase = overallScore * 0.9 + randomNormal(0, 4);
    const toneQuality = {
        harmonicsScore: clamp(toneBase * 0.95, 40, 99),
        spectralCentroid: clamp(1100 - (toneBase * 2.5), 850, 1400),
        consistency: clamp(toneBase * 0.88, 45, 97)
    };

    // 姿勢數據
    const postureBase = overallScore * 0.92 + randomNormal(0, 3);
    const postureMetrics = {
        embouchureCorrectness: clamp(postureBase * 0.93, 45, 99),
        shoulderBalance: clamp(postureBase * 0.96, 50, 99),
        overallPosture: clamp(postureBase * 0.9, 45, 98)
    };

    // 練習筆記（偶爾添加）
    let notes: string | undefined;
    if (Math.random() < 0.12) {
        notes = generatePracticeNote(overallScore, specialEvent);
    }

    return {
        id: `session_${String(sessionId).padStart(5, '0')}`,
        timestamp: sessionTimestamp,
        duration,
        instrument,
        pitchAccuracy,
        toneQuality,
        postureMetrics,
        practiceType,
        overallScore: Math.round(overallScore * 10) / 10,
        notes
    };
}

/**
 * 選擇練習類型
 */
function selectPracticeType(
    skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert'
): PracticeSession['practiceType'] {
    const rand = Math.random();

    if (skillLevel === 'beginner') {
        if (rand < 0.4) return 'long_tone';
        if (rand < 0.7) return 'scale';
        if (rand < 0.9) return 'technical';
        return 'piece';
    } else if (skillLevel === 'intermediate') {
        if (rand < 0.25) return 'long_tone';
        if (rand < 0.5) return 'scale';
        if (rand < 0.7) return 'technical';
        if (rand < 0.85) return 'piece';
        return 'mixed';
    } else if (skillLevel === 'advanced') {
        if (rand < 0.15) return 'long_tone';
        if (rand < 0.3) return 'scale';
        if (rand < 0.5) return 'technical';
        if (rand < 0.8) return 'piece';
        return 'mixed';
    } else {
        if (rand < 0.1) return 'long_tone';
        if (rand < 0.2) return 'scale';
        if (rand < 0.4) return 'technical';
        if (rand < 0.7) return 'piece';
        return 'mixed';
    }
}

/**
 * 生成練習筆記
 */
function generatePracticeNote(
    score: number,
    specialEvent: number
): string {
    if (specialEvent > 5) {
        const notes = ['今天突破了！高音 E 終於吹穩了', '感覺音色變通透了，開心！', '老師說進步很明顯', '連續練習有成效，繼續加油', '今天狀態特別好'];
        return notes[Math.floor(Math.random() * notes.length)];
    } else if (specialEvent < -5) {
        const notes = ['今天狀態不太好，明天再努力', '嘴型還是不太穩定', '需要多練長音', '有點累了，休息一下'];
        return notes[Math.floor(Math.random() * notes.length)];
    } else if (score > 85) {
        const notes = ['練習感覺很順', '音準穩定了不少', '長音有進步', '繼續保持'];
        return notes[Math.floor(Math.random() * notes.length)];
    } else {
        const notes = ['常規練習', '基礎訓練', '需要多加強音階', '專注呼吸控制'];
        return notes[Math.floor(Math.random() * notes.length)];
    }
}

/**
 * 練習類型加成
 */
function getPracticeTypeBonus(practiceType: PracticeSession['practiceType']): number {
    const bonuses = {
        'long_tone': 3,
        'scale': 2.5,
        'technical': 2,
        'piece': 1,
        'mixed': 2
    };
    return bonuses[practiceType];
}

/**
 * 正態分佈隨機數
 */
function randomNormal(mean: number, stdDev: number): number {
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
