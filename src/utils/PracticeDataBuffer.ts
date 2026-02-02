/**
 * PracticeDataBuffer - 管理練習數據的歷史記錄
 * 用於音高軌跡、音量包絡和穩定度分析
 */

export interface PitchPoint {
    frequency: number;
    timestamp: number;
    stability: number; // 0-100
    note: string;
    deviation: number; // cents
}

export interface VolumePoint {
    level: number; // 0-100
    timestamp: number;
}

export class PracticeDataBuffer {
    private pitchHistory: PitchPoint[] = [];
    private volumeHistory: VolumePoint[] = [];
    private readonly maxPoints: number;
    private readonly timeWindow: number; // milliseconds

    constructor(maxPoints: number = 120, timeWindowSeconds: number = 10) {
        this.maxPoints = maxPoints;
        this.timeWindow = timeWindowSeconds * 1000;
    }

    /**
     * 添加音高數據點
     */
    addPitchPoint(point: PitchPoint): void {
        this.pitchHistory.push(point);

        // 保持數量限制
        if (this.pitchHistory.length > this.maxPoints) {
            this.pitchHistory.shift();
        }

        // 清除過期數據
        this.cleanOldData();
    }

    /**
     * 添加音量數據點
     */
    addVolumePoint(point: VolumePoint): void {
        this.volumeHistory.push(point);

        // 保持數量限制
        if (this.volumeHistory.length > this.maxPoints) {
            this.volumeHistory.shift();
        }

        // 清除過期數據
        this.cleanOldData();
    }

    /**
     * 獲取音高歷史
     */
    getPitchHistory(): PitchPoint[] {
        return [...this.pitchHistory];
    }

    /**
     * 獲取音量歷史
     */
    getVolumeHistory(): VolumePoint[] {
        return [...this.volumeHistory];
    }

    /**
     * 計算當前穩定度（基於最近 2 秒的數據）
     */
    calculateStability(): number {
        const now = Date.now();
        const recentWindow = 2000; // 2 seconds

        // 獲取最近的音高數據
        const recentPitches = this.pitchHistory.filter(
            p => now - p.timestamp < recentWindow
        );

        const recentVolumes = this.volumeHistory.filter(
            v => now - v.timestamp < recentWindow
        );

        if (recentPitches.length < 3) {
            return 0; // 數據不足
        }

        // 計算音高方差
        const pitchFrequencies = recentPitches.map(p => p.frequency);
        const pitchMean = pitchFrequencies.reduce((a, b) => a + b, 0) / pitchFrequencies.length;
        const pitchVariance = pitchFrequencies.reduce((sum, freq) => {
            return sum + Math.pow(freq - pitchMean, 2);
        }, 0) / pitchFrequencies.length;
        const pitchStdDev = Math.sqrt(pitchVariance);

        // 計算音量方差
        let volumeStdDev = 0;
        if (recentVolumes.length >= 3) {
            const volumes = recentVolumes.map(v => v.level);
            const volumeMean = volumes.reduce((a, b) => a + b, 0) / volumes.length;
            const volumeVariance = volumes.reduce((sum, vol) => {
                return sum + Math.pow(vol - volumeMean, 2);
            }, 0) / volumes.length;
            volumeStdDev = Math.sqrt(volumeVariance);
        }

        // 穩定度評分 (0-100)
        // 音高標準差越小越好，音量標準差影響較小
        const pitchScore = Math.max(0, 100 - pitchStdDev * 2);
        const volumeScore = Math.max(0, 100 - volumeStdDev);

        const stability = pitchScore * 0.7 + volumeScore * 0.3;

        return Math.round(Math.max(0, Math.min(100, stability)));
    }

    /**
     * 計算音高點的局部穩定度
     * 用於軌跡線的顏色編碼
     */
    calculateLocalStability(index: number, windowSize: number = 5): number {
        if (index < windowSize || index >= this.pitchHistory.length) {
            return 50; // 默認中等穩定度
        }

        const window = this.pitchHistory.slice(index - windowSize, index + 1);
        const frequencies = window.map(p => p.frequency);
        const mean = frequencies.reduce((a, b) => a + b, 0) / frequencies.length;

        const variance = frequencies.reduce((sum, freq) => {
            return sum + Math.pow(freq - mean, 2);
        }, 0) / frequencies.length;

        const stdDev = Math.sqrt(variance);

        // 轉換為 0-100 評分
        return Math.round(Math.max(0, Math.min(100, 100 - stdDev * 2)));
    }

    /**
     * 清除所有數據
     */
    clear(): void {
        this.pitchHistory = [];
        this.volumeHistory = [];
    }

    /**
     * 清除超時數據
     */
    private cleanOldData(): void {
        const now = Date.now();

        this.pitchHistory = this.pitchHistory.filter(
            p => now - p.timestamp < this.timeWindow
        );

        this.volumeHistory = this.volumeHistory.filter(
            v => now - v.timestamp < this.timeWindow
        );
    }

    /**
     * 獲取數據統計
     */
    getStats() {
        return {
            pitchPoints: this.pitchHistory.length,
            volumePoints: this.volumeHistory.length,
            oldestPitchAge: this.pitchHistory.length > 0
                ? Date.now() - this.pitchHistory[0].timestamp
                : 0,
            newestPitchAge: this.pitchHistory.length > 0
                ? Date.now() - this.pitchHistory[this.pitchHistory.length - 1].timestamp
                : 0,
        };
    }
}
