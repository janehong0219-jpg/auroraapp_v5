/**
 * 樂器配置 - 定義不同樂器的特性和音域
 */

export type InstrumentType = 'vocal' | 'flute' | 'clarinet' | 'saxophone' | 'recorder' | 'ocarina' | 'chinese-flute' | 'harmonica';

export interface InstrumentConfig {
    id: InstrumentType;
    name: string;
    nameChinese: string;
    icon: string; // Color gradient for badge
    iconText: string; // Letter to display
    monitoringMode: 'vocal' | 'flute' | 'reed'; // Embouchure monitoring strategy

    // 音域範圍 (Hz)
    range: {
        min: number;
        max: number;
    };

    // 最佳練習音域
    optimalRange: {
        min: number;
        max: number;
    };

    // 音色特性描述
    toneCharacteristics: {
        ideal: string;
        tips: string[];
    };

    // 針對此樂器的特殊建議
    specificTips: {
        breath: string;
        embouchure: string;
        tone: string;
    };
}

export const INSTRUMENT_CONFIGS: Record<InstrumentType, InstrumentConfig> = {
    // 聲樂/唱歌
    vocal: {
        id: 'vocal',
        name: 'Vocal',
        nameChinese: '聲樂',
        icon: 'from-purple-500 to-pink-500',
        iconText: 'V',
        monitoringMode: 'vocal',
        range: {
            min: 82,   // E2 (男低音)
            max: 1319  // E6 (女高音)
        },
        optimalRange: {
            min: 131,  // C3
            max: 1047  // C6
        },
        toneCharacteristics: {
            ideal: '圓潤通透、共鳴飽滿',
            tips: [
                '保持喉嚨放鬆',
                '使用腹式呼吸',
                '注意嘴型和共鳴腔'
            ]
        },
        specificTips: {
            breath: '深呼吸，用腹部支撐，保持氣息穩定流暢',
            embouchure: '嘴型要自然放鬆，根據音高調整開口大小和形狀',
            tone: '追求圓潤飽滿的音色，善用頭腔、胸腔共鳴'
        }
    },

    // 長笛
    flute: {
        id: 'flute',
        name: 'Flute',
        nameChinese: '長笛',
        icon: 'from-sky-500 to-blue-500',
        iconText: 'FL',
        monitoringMode: 'flute',
        range: {
            min: 262,  // C4
            max: 2349  // D7
        },
        optimalRange: {
            min: 349,  // F4
            max: 1568  // G6
        },
        toneCharacteristics: {
            ideal: '明亮清澈、飄逸靈動',
            tips: [
                '氣流要集中穩定',
                '嘴唇開口大小影響音色',
                '保持音色純淨透明'
            ]
        },
        specificTips: {
            breath: '使用腹式呼吸，氣流要快速集中',
            embouchure: '下唇蓋住吹口約1/3，調整角度控制音高',
            tone: '追求清澈透明的音色，避免氣音過重'
        }
    },

    // 豎笛
    clarinet: {
        id: 'clarinet',
        name: 'Clarinet',
        nameChinese: '豎笛',
        icon: 'from-amber-500 to-orange-500',
        iconText: 'CL',
        monitoringMode: 'reed',
        range: {
            min: 147,  // D3
            max: 1568  // G6
        },
        optimalRange: {
            min: 196,  // G3
            max: 1047  // C6
        },
        toneCharacteristics: {
            ideal: '溫暖圓潤、表現力強',
            tips: [
                '使用單簧片控制',
                '氣流要穩定連貫',
                '注意音域間的音色統一'
            ]
        },
        specificTips: {
            breath: '保持恆定的氣壓，支撐要穩',
            embouchure: '下唇輕墊牙齒，上牙輕放簧片，嘴角收緊',
            tone: '追求溫暖飽滿的音色，各音域保持一致'
        }
    },

    // 薩克斯風
    saxophone: {
        id: 'saxophone',
        name: 'Saxophone',
        nameChinese: '薩克斯風',
        icon: 'from-yellow-500 to-amber-600',
        iconText: 'SX',
        monitoringMode: 'reed',
        range: {
            min: 139,  // C#3 (Alto Sax)
            max: 880   // A5
        },
        optimalRange: {
            min: 175,  // F3
            max: 698   // F5
        },
        toneCharacteristics: {
            ideal: '厚實豐富、富有表情',
            tips: [
                '氣流要飽滿有力',
                '控制簧片震動',
                '發揮共鳴特性'
            ]
        },
        specificTips: {
            breath: '用大量穩定的氣流，支撐要強',
            embouchure: '嘴型要放鬆但有控制，讓簧片自由震動',
            tone: '追求溫暖厚實的音色，充分共鳴'
        }
    },

    // 直笛
    recorder: {
        id: 'recorder',
        name: 'Recorder',
        nameChinese: '直笛',
        icon: 'from-emerald-500 to-teal-500',
        iconText: 'RC',
        monitoringMode: 'reed',
        range: {
            min: 262,  // C4 (高音直笛)
            max: 2093  // C7
        },
        optimalRange: {
            min: 349,  // F4
            max: 1175  // D6
        },
        toneCharacteristics: {
            ideal: '清澈透亮、純淨柔和',
            tips: [
                '氣流要輕柔穩定',
                '避免過度用力',
                '保持音色純淨'
            ]
        },
        specificTips: {
            breath: '用柔和穩定的氣流，避免太強',
            embouchure: '嘴唇輕輕含住吹口，不要咬緊',
            tone: '追求清澈純淨的音色，避免雜音'
        }
    },

    // 陶笛
    ocarina: {
        id: 'ocarina',
        name: 'Ocarina',
        nameChinese: '陶笛',
        icon: 'from-rose-500 to-pink-500',
        iconText: 'OC',
        monitoringMode: 'reed',
        range: {
            min: 262,  // C4 (12孔AC調)
            max: 1568  // G6
        },
        optimalRange: {
            min: 330,  // E4
            max: 1047  // C6
        },
        toneCharacteristics: {
            ideal: '溫暖圓潤、飽滿厚實',
            tips: [
                '氣流要集中穩定',
                '低音用較強氣流',
                '高音控制氣壓'
            ]
        },
        specificTips: {
            breath: '根據音高調整氣流強度，低音較強、高音較弱',
            embouchure: '嘴唇完全包住吹口，保持氣密',
            tone: '追求溫暖厚實的音色，注意共鳴'
        }
    },

    // 中國笛（梆笛/曲笛）
    'chinese-flute': {
        id: 'chinese-flute',
        name: 'Chinese Flute',
        nameChinese: '中國笛',
        icon: 'from-indigo-500 to-purple-500',
        iconText: 'CF',
        monitoringMode: 'flute',
        range: {
            min: 196,  // G3 (曲笛)
            max: 1568  // G6
        },
        optimalRange: {
            min: 294,  // D4
            max: 1175  // D6
        },
        toneCharacteristics: {
            ideal: '明亮穿透、韻味十足',
            tips: [
                '笛膜要震動靈敏',
                '氣流要有彈性',
                '注意運氣技巧'
            ]
        },
        specificTips: {
            breath: '氣流要有彈性變化，配合運氣技巧',
            embouchure: '風門大小要隨音高調整，注意角度',
            tone: '追求明亮穿透的音色，發揮笛膜共鳴'
        }
    },


    // 口琴
    harmonica: {
        id: 'harmonica',
        name: 'Harmonica',
        nameChinese: '口琴',
        icon: 'from-slate-400 to-blue-400',
        iconText: 'HA',
        monitoringMode: 'reed', // 口琴會遮住嘴巴，使用 reed 模式較適合（或不顯示嘴型）
        range: {
            min: 130,  // C3
            max: 2093  // C7
        },
        optimalRange: {
            min: 262,  // C4
            max: 1047  // C6
        },
        toneCharacteristics: {
            ideal: '甚至清晰、富有情感',
            tips: [
                '保持口腔空間',
                '控制手部震音',
                '注意單音清晰度'
            ]
        },
        specificTips: {
            breath: '使用腹式呼吸，氣流要穩定且深長',
            embouchure: '嘴型像發"O"的音，將琴格含深一點以獲得飽滿音色',
            tone: '追求清晰且富有共鳴的音色，善用手部製造哇音效果'
        }
    }
};

/**
 * 根據音高判斷是否在樂器最佳音域內
 */
export function isInOptimalRange(frequency: number, instrument: InstrumentType): boolean {
    const config = INSTRUMENT_CONFIGS[instrument];
    return frequency >= config.optimalRange.min && frequency <= config.optimalRange.max;
}

/**
 * 根據音高判斷是否在樂器可演奏範圍內
 */
export function isInPlayableRange(frequency: number, instrument: InstrumentType): boolean {
    const config = INSTRUMENT_CONFIGS[instrument];
    return frequency >= config.range.min && frequency <= config.range.max;
}

/**
 * 獲取樂器特定的音色建議
 */
export function getInstrumentSpecificTip(
    instrument: InstrumentType,
    context: 'breath' | 'embouchure' | 'tone'
): string {
    const config = INSTRUMENT_CONFIGS[instrument];
    return config.specificTips[context];
}
