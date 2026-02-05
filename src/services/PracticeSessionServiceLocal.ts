/**
 * 本地存儲版本的練習分析系統
 * 不需要 Firebase，所有數據儲存在瀏覽器 LocalStorage
 */

import type { PracticeSession } from '../utils/generatePracticeData';

const STORAGE_KEY = 'aurora_practice_sessions';

/**
 * 儲存練習數據到 LocalStorage
 */
export async function uploadPracticeSessionsLocal(
    sessions: PracticeSession[],
    batchSize: number = 10,
    onProgress?: (uploaded: number, total: number) => void
): Promise<void> {
    const total = sessions.length;

    console.log(`開始儲存 ${total} 筆練習數據到本地...`);

    // 模擬批次上傳延遲
    for (let i = 0; i < sessions.length; i += batchSize) {
        const batch = sessions.slice(i, i + batchSize);

        // 獲取現有數據
        const existing = getAllSessionsLocal();

        // 合併新數據
        const updated = [...existing, ...batch];

        // 儲存到 LocalStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

        const uploaded = i + batch.length;
        console.log(`已儲存: ${uploaded}/${total} (${((uploaded / total) * 100).toFixed(1)}%)`);

        if (onProgress) {
            onProgress(uploaded, total);
        }

        // 模擬延遲
        if (i + batchSize < sessions.length) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }

    console.log('✅ 所有數據儲存完成！');
}

/**
 * 從 LocalStorage 讀取所有練習數據
 */
export async function fetchPracticeSessionsLocal(
    maxCount: number = 100
): Promise<PracticeSession[]> {
    try {
        const sessions = getAllSessionsLocal();

        // 按時間排序並限制數量
        const sorted = sessions
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(0, maxCount);

        console.log(`✅ 成功讀取 ${sorted.length} 筆本地練習數據`);
        return sorted;
    } catch (error) {
        console.error('❌ 讀取本地練習數據失敗:', error);
        return [];
    }
}

/**
 * 獲取最近 N 次練習
 */
export async function fetchRecentSessionsLocal(count: number = 10): Promise<PracticeSession[]> {
    try {
        const sessions = getAllSessionsLocal();

        // 按時間降序排序並取前 N 個
        const recent = sessions
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, count);

        return recent.reverse(); // 反轉為升序
    } catch (error) {
        console.error('❌ 讀取最近練習數據失敗:', error);
        return [];
    }
}

/**
 * 清除所有本地練習數據
 */
export async function clearAllSessionsLocal(): Promise<void> {
    try {
        const sessions = getAllSessionsLocal();
        localStorage.removeItem(STORAGE_KEY);
        console.log(`✅ 已刪除 ${sessions.length} 筆本地練習數據`);
    } catch (error) {
        console.error('❌ 刪除本地練習數據失敗:', error);
        throw error;
    }
}

/**
 * 獲取練習數據統計
 */
export async function getSessionStatisticsLocal(): Promise<{
    totalSessions: number;
    averageScore: number;
    totalPracticeTime: number;
}> {
    try {
        const sessions = getAllSessionsLocal();

        if (sessions.length === 0) {
            return {
                totalSessions: 0,
                averageScore: 0,
                totalPracticeTime: 0
            };
        }

        const totalSessions = sessions.length;
        const averageScore = sessions.reduce((sum, s) => sum + s.overallScore, 0) / totalSessions;
        const totalPracticeTime = sessions.reduce((sum, s) => sum + s.duration, 0);

        return {
            totalSessions,
            averageScore: Math.round(averageScore * 10) / 10,
            totalPracticeTime
        };
    } catch (error) {
        console.error('❌ 計算統計數據失敗:', error);
        throw error;
    }
}

/**
 * 輔助函數：從 LocalStorage 獲取所有數據
 */
function getAllSessionsLocal(): PracticeSession[] {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];

    try {
        return JSON.parse(data);
    } catch (error) {
        console.error('解析本地數據失敗:', error);
        return [];
    }
}
