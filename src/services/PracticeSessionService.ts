/**
 * 練習數據服務 - Firebase 儲存和讀取
 */

import { collection, addDoc, getDocs, query, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { PracticeSession } from '../utils/generatePracticeData';

const COLLECTION_NAME = 'practice_sessions';

/**
 * 移除對象中的 undefined 字段（Firestore 不允許 undefined）
 */
function cleanUndefinedFields<T extends Record<string, any>>(obj: T): Partial<T> {
    const cleaned: any = {};

    for (const key in obj) {
        if (obj[key] !== undefined) {
            cleaned[key] = obj[key];
        }
    }

    return cleaned;
}

/**
 * 批次上傳練習數據到 Firebase
 */
export async function uploadPracticeSessions(
    sessions: PracticeSession[],
    batchSize: number = 10,
    onProgress?: (uploaded: number, total: number) => void
): Promise<void> {
    const total = sessions.length;
    let uploaded = 0;

    console.log(`開始上傳 ${total} 筆練習數據...`);

    // 分批上傳以避免超過 Firebase 配額
    for (let i = 0; i < sessions.length; i += batchSize) {
        const batch = sessions.slice(i, i + batchSize);

        // 並行上傳當前批次（清理 undefined 字段）
        await Promise.all(
            batch.map(session =>
                addDoc(collection(db, COLLECTION_NAME), cleanUndefinedFields(session))
            )
        );

        uploaded += batch.length;
        console.log(`已上傳: ${uploaded}/${total} (${((uploaded / total) * 100).toFixed(1)}%)`);

        if (onProgress) {
            onProgress(uploaded, total);
        }

        // 添加小延遲以避免觸發速率限制
        if (i + batchSize < sessions.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    console.log('✅ 所有數據上傳完成！');
}

/**
 * 從 Firebase 讀取所有練習數據
 */
export async function fetchPracticeSessions(
    maxCount: number = 100
): Promise<PracticeSession[]> {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            orderBy('timestamp', 'asc'),
            limit(maxCount)
        );

        const querySnapshot = await getDocs(q);
        const sessions: PracticeSession[] = [];

        querySnapshot.forEach((doc) => {
            sessions.push(doc.data() as PracticeSession);
        });

        console.log(`✅ 成功讀取 ${sessions.length} 筆練習數據`);
        return sessions;
    } catch (error) {
        console.error('❌ 讀取練習數據失敗:', error);
        throw error;
    }
}

/**
 * 獲取最近 N 次練習
 */
export async function fetchRecentSessions(count: number = 10): Promise<PracticeSession[]> {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            orderBy('timestamp', 'desc'),
            limit(count)
        );

        const querySnapshot = await getDocs(q);
        const sessions: PracticeSession[] = [];

        querySnapshot.forEach((doc) => {
            sessions.push(doc.data() as PracticeSession);
        });

        // 反轉順序（從舊到新）
        return sessions.reverse();
    } catch (error) {
        console.error('❌ 讀取最近練習數據失敗:', error);
        throw error;
    }
}

/**
 * 刪除所有練習數據（慎用！）
 */
export async function clearAllSessions(): Promise<void> {
    try {
        const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));

        const deletePromises = querySnapshot.docs.map(doc =>
            deleteDoc(doc.ref)
        );

        await Promise.all(deletePromises);
        console.log(`✅ 已刪除 ${querySnapshot.size} 筆練習數據`);
    } catch (error) {
        console.error('❌ 刪除練習數據失敗:', error);
        throw error;
    }
}

/**
 * 獲取練習數據統計
 */
export async function getSessionStatistics(): Promise<{
    totalSessions: number;
    averageScore: number;
    totalPracticeTime: number;
}> {
    try {
        const sessions = await fetchPracticeSessions();

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
