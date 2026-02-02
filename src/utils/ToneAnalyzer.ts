/**
 * ToneAnalyzer - Analyzes harmonic content and provides actionable feedback
 */

export interface HarmonicData {
    f1: number;
    f2: number;
    f3: number;
    score: number;
}

export interface ToneQuality {
    overall: number; // 0-100
    brightness: number; // 0-100
    richness: number; // 0-100
    balance: number; // 0-100
}

export interface ToneSuggestion {
    type: 'excellent' | 'good' | 'needsWork' | 'critical';
    message: string;
    icon: string;
    tip?: string;
}

export class ToneAnalyzer {

    /**
     * Analyze harmonic ratios and return quality metrics
     */
    static analyzeToneQuality(harmonics: HarmonicData): ToneQuality {
        const { f1, f2, f3, score } = harmonics;

        // Calculate ratios
        const f3Ratio = f3 / (f1 + 0.001);

        // Brightness: higher f3 ratio = brighter tone
        // Ideal range: 0.3-0.7 for balanced tone
        const brightness = Math.min(100, f3Ratio * 150);

        // Richness: presence of harmonics
        // Ideal: both f2 and f3 present
        const richness = Math.min(100, score * 80);

        // Balance: f2 and f3 should be proportional
        // Ideal f2:f3 ratio around 1.2:1 to 2:1
        const idealRatio = 1.5;
        const actualRatio = f2 / (f3 + 0.001);
        const balanceDeviation = Math.abs(actualRatio - idealRatio) / idealRatio;
        const balance = Math.max(0, 100 - balanceDeviation * 100);

        // Overall quality (weighted average)
        const overall = (richness * 0.4 + balance * 0.3 + brightness * 0.3);

        return {
            overall: Math.round(overall),
            brightness: Math.round(brightness),
            richness: Math.round(richness),
            balance: Math.round(balance)
        };
    }

    /**
     * Generate intelligent suggestions based on harmonic analysis
     */
    static getSuggestion(harmonics: HarmonicData, quality: ToneQuality): ToneSuggestion {
        const { f1, f2, f3 } = harmonics;
        const { overall, brightness, richness, balance } = quality;

        // Calculate ratios
        const f2Ratio = f2 / (f1 + 0.001);
        const f3Ratio = f3 / (f1 + 0.001);

        // Excellent tone
        if (overall >= 80 && balance >= 70) {
            return {
                type: 'excellent',
                message: '完美的音色！',
                icon: '✨',
                tip: '繼續保持這個狀態，音色非常飽滿'
            };
        }

        // Good tone with minor improvements
        if (overall >= 60) {
            if (brightness < 40) {
                return {
                    type: 'good',
                    message: '音色偏暗',
                    icon: '🌙',
                    tip: '試著加強氣流速度，讓聲音更明亮'
                };
            }
            if (brightness > 80) {
                return {
                    type: 'good',
                    message: '音色偏亮',
                    icon: '☀️',
                    tip: '可以稍微放鬆嘴型，讓音色更圓潤'
                };
            }
            return {
                type: 'good',
                message: '音色不錯！',
                icon: '👍',
                tip: '再多練習穩定度，會更好'
            };
        }

        // Needs work - specific issues
        if (f2Ratio < 0.3 && f3Ratio < 0.2) {
            return {
                type: 'needsWork',
                message: '泛音較弱',
                icon: '🎯',
                tip: '試著放鬆喉嚨和嘴巴，讓氣流更自然流動'
            };
        }

        if (f3Ratio > 1.0) {
            return {
                type: 'needsWork',
                message: '嘴型過緊',
                icon: '😮',
                tip: '嘴唇稍微放鬆一點，不要咬得太緊'
            };
        }

        if (balance < 40) {
            return {
                type: 'needsWork',
                message: '泛音不平衡',
                icon: '⚖️',
                tip: '調整嘴型和氣流，讓音色更均勻'
            };
        }

        // Default suggestion
        if (richness < 30) {
            return {
                type: 'critical',
                message: '音色單薄',
                icon: '🎵',
                tip: '專注在穩定的氣流支撐，從腹部呼吸'
            };
        }

        return {
            type: 'needsWork',
            message: '音色需要改善',
            icon: '💪',
            tip: '檢查嘴型、氣流和姿勢，慢慢調整'
        };
    }

    /**
     * Get tone color description based on harmonic content
     */
    static getToneColor(harmonics: HarmonicData): string {
        const { f1, f2, f3 } = harmonics;
        const f2Ratio = f2 / (f1 + 0.001);
        const f3Ratio = f3 / (f1 + 0.001);

        if (f2Ratio > 0.6 && f3Ratio > 0.5) {
            return '明亮飽滿';
        }
        if (f2Ratio > 0.5 && f3Ratio < 0.3) {
            return '溫暖圓潤';
        }
        if (f2Ratio < 0.3 && f3Ratio < 0.3) {
            return '柔和暗淡';
        }
        if (f3Ratio > 0.7) {
            return '銳利明亮';
        }
        return '中性平衡';
    }
}
