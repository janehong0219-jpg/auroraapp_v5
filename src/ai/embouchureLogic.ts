import { type Keypoint } from '@tensorflow-models/face-landmarks-detection';

// 聲樂模式 - 完整嘴型監測
export interface EmbouchureMetrics {
    aperture: number; // Vertical distance between lips
    width: number;    // Horizontal distance between mouth corners
    pucker: number;   // Ratio or other metric to detect "puckering" vs "smiling"
}

// 長笛模式 - 嘴角 + 上唇張力
export interface FluteMetrics {
    mouthCornerRatio: number;      // 嘴角寬度相對於眼距的比例
    upperLipTension: number;       // 上唇張力（人中長度）
    isTooTight: boolean;           // 是否過度緊繃（微笑）
    isTooSmall: boolean;           // 是否開口過小
    philtrumLength: number;         // 人中長度（原始值）
    mouthAperture: number;          // 嘴巴開口高度
    smileTension?: {                // 微笑緊張偵測（新增）
        isTooWide: boolean;
        mouthWidthRatio: number;
    };
}

// 直笛/簧片樂器模式 - 臉頰 + 下顎
export interface ReedMetrics {
    cheekPuffingLeft: number;      // 左臉頰鼓起度
    cheekPuffingRight: number;     // 右臉頰鼓起度
    cheekPuffingAvg: number;       // 平均臉頰鼓起度
    jawlineRelaxation: number;     // 下顎放鬆度（0-1，越大越放鬆）
    isPuffingCheeks: boolean;      // 是否在鼓腮
    isJawTight: boolean;           // 下顎是否緊繃
}

// 統一監測數據接口
export interface UnifiedEmbouchureMetrics {
    mode: 'vocal' | 'flute' | 'reed';

    // 聲樂數據
    vocal?: EmbouchureMetrics | null;

    // 長笛數據
    flute?: FluteMetrics | null;

    // 直笛/簧片數據
    reed?: ReedMetrics | null;
}

// MediaPipe Face Mesh 關鍵點索引
const LANDMARKS = {
    // 嘴巴
    LIP_TOP: 13,
    LIP_BOTTOM: 14,
    MOUTH_LEFT: 61,
    MOUTH_RIGHT: 291,
    UPPER_LIP_TOP: 0,
    UPPER_LIP_BOTTOM: 17,

    // 眼睛（用於計算基準距離）
    LEFT_EYE_OUTER: 33,
    RIGHT_EYE_OUTER: 263,

    // 人中
    PHILTRUM_TOP: 19,
    PHILTRUM_BOTTOM: 164,

    // 臉頰
    LEFT_CHEEK: 50,
    RIGHT_CHEEK: 280,
    LEFT_CHEEK_BONE: 266,
    RIGHT_CHEEK_BONE: 36,

    // 下顎
    JAWLINE_LEFT: 172,
    JAWLINE_RIGHT: 397,
    CHIN: 152,
    JAW_LEFT_MID: 136,
    JAW_RIGHT_MID: 365,
};

function getDistance(p1: Keypoint, p2: Keypoint): number {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

function getDepth(p1: Keypoint, p2: Keypoint): number {
    // z 值表示深度，用於檢測臉頰鼓起
    return Math.abs((p1.z || 0) - (p2.z || 0));
}

/**
 * 偵測微笑緊張（嘴角過度後拉）
 * 原理：當嘴角距離相對於臉寬超過 45%，表示過度拉扯
 * 這會導致氣流變扁，影響音色
 */
function detectSmileTension(
    keypoints: Keypoint[]
): { isTooWide: boolean; mouthWidthRatio: number } {
    const leftCorner = keypoints[LANDMARKS.MOUTH_LEFT];   // 左嘴角 (61)
    const rightCorner = keypoints[LANDMARKS.MOUTH_RIGHT]; // 右嘴角 (291)
    const leftEye = keypoints[LANDMARKS.LEFT_EYE_OUTER];  // 左眼外角 (33)
    const rightEye = keypoints[LANDMARKS.RIGHT_EYE_OUTER];// 右眼外角 (263)

    if (!leftCorner || !rightCorner || !leftEye || !rightEye) {
        return { isTooWide: false, mouthWidthRatio: 0 };
    }

    const mouthWidth = getDistance(leftCorner, rightCorner);
    const faceWidth = getDistance(leftEye, rightEye);

    // 避免除以零
    if (faceWidth === 0) {
        return { isTooWide: false, mouthWidthRatio: 0 };
    }

    const mouthWidthRatio = mouthWidth / faceWidth;

    // 閾值：嘴寬超過臉寬的 45% 視為過度拉扯（微笑狀態）
    const isTooWide = mouthWidthRatio > 0.45;

    console.log(`👄 嘴寬比例: ${(mouthWidthRatio * 100).toFixed(1)}% ${isTooWide ? '⚠️ 太緊張！' : '✅ 正常'}`);

    return { isTooWide, mouthWidthRatio };
}

/**
 * 策略 A：聲樂模式 - 完整嘴型監測
 */
export function calculateEmbouchure(keypoints: Keypoint[]): EmbouchureMetrics | null {
    if (!keypoints || keypoints.length < 468) return null;

    const lipTop = keypoints[LANDMARKS.LIP_TOP];
    const lipBottom = keypoints[LANDMARKS.LIP_BOTTOM];
    const mouthLeft = keypoints[LANDMARKS.MOUTH_LEFT];
    const mouthRight = keypoints[LANDMARKS.MOUTH_RIGHT];

    if (!lipTop || !lipBottom || !mouthLeft || !mouthRight) return null;

    const aperture = getDistance(lipTop, lipBottom);
    const width = getDistance(mouthLeft, mouthRight);

    return {
        aperture,
        width,
        pucker: width / (aperture + 0.001) // 防止除零
    };
}

/**
 * 策略 B：長笛模式 - 嘴角寬度比例 + 上唇張力
 */
export function calculateFluteEmbouchure(keypoints: Keypoint[]): FluteMetrics | null {
    if (!keypoints || keypoints.length < 468) return null;

    const mouthLeft = keypoints[LANDMARKS.MOUTH_LEFT];
    const mouthRight = keypoints[LANDMARKS.MOUTH_RIGHT];
    const lipTop = keypoints[LANDMARKS.LIP_TOP];
    const lipBottom = keypoints[LANDMARKS.LIP_BOTTOM];
    const leftEye = keypoints[LANDMARKS.LEFT_EYE_OUTER];
    const rightEye = keypoints[LANDMARKS.RIGHT_EYE_OUTER];
    const philtrumTop = keypoints[LANDMARKS.PHILTRUM_TOP];
    const philtrumBottom = keypoints[LANDMARKS.PHILTRUM_BOTTOM];

    if (!mouthLeft || !mouthRight || !lipTop || !lipBottom || !leftEye || !rightEye || !philtrumTop || !philtrumBottom) {
        return null;
    }

    // 計算嘴角寬度
    const mouthWidth = getDistance(mouthLeft, mouthRight);

    // 計算眼距（作為基準）
    const eyeDistance = getDistance(leftEye, rightEye);

    // 嘴角寬度比例
    const mouthCornerRatio = mouthWidth / (eyeDistance + 0.001);

    // 人中長度（反映上唇張力）
    const philtrumLength = getDistance(philtrumTop, philtrumBottom);

    // 計算嘴巴開口大小（垂直距離）
    const mouthAperture = getDistance(lipTop, lipBottom);

    // 計算開口相對於眼距的比例
    const apertureRatio = mouthAperture / (eyeDistance + 0.001);

    // 判定是否過度緊繃（嘴角過寬 = 微笑狀態）
    // 正常範圍約 0.6-0.7，超過 0.75 表示過度微笑
    const isTooTight = mouthCornerRatio > 0.75;

    // 判定是否開口過小
    // 正常範圍約 0.10-0.20，小於 0.10 表示嘴巴太小或緊閉
    const isTooSmall = apertureRatio < 0.10;

    // 上唇張力：人中拉長 = 用力，縮短 = 放鬆
    // 正常範圍約 0.02-0.04
    const upperLipTension = philtrumLength;

    // Debug: 輸出數值以便調整閾值（可在瀏覽器 Console 查看）
    if (typeof window !== 'undefined' && Math.random() < 0.1) { // 只輸出 10% 的幀避免洪水
        console.log('🎺 Flute Metrics:', {
            apertureRatio: apertureRatio.toFixed(3),
            mouthCornerRatio: mouthCornerRatio.toFixed(3),
            isTooSmall,
            isTooTight
        });
    }

    // 偵測微笑緊張（新增功能）
    const smileTension = detectSmileTension(keypoints);

    return {
        mouthCornerRatio,
        upperLipTension,
        isTooTight,
        isTooSmall,
        philtrumLength,
        mouthAperture,
        smileTension  // 新增欄位
    };
}

/**
 * 策略 C：直笛/簧片模式 - 臉頰鼓起 + 下顎放鬆
 */
export function calculateReedEmbouchure(keypoints: Keypoint[]): ReedMetrics | null {
    if (!keypoints || keypoints.length < 468) return null;

    const leftCheek = keypoints[LANDMARKS.LEFT_CHEEK];
    const rightCheek = keypoints[LANDMARKS.RIGHT_CHEEK];
    const leftCheekBone = keypoints[LANDMARKS.LEFT_CHEEK_BONE];
    const rightCheekBone = keypoints[LANDMARKS.RIGHT_CHEEK_BONE];
    const jawLeft = keypoints[LANDMARKS.JAWLINE_LEFT];
    const jawRight = keypoints[LANDMARKS.JAWLINE_RIGHT];
    const chin = keypoints[LANDMARKS.CHIN];
    const jawLeftMid = keypoints[LANDMARKS.JAW_LEFT_MID];
    const jawRightMid = keypoints[LANDMARKS.JAW_RIGHT_MID];

    if (!leftCheek || !rightCheek || !leftCheekBone || !rightCheekBone) {
        return null;
    }

    // 計算臉頰鼓起度（使用深度信息）
    // 臉頰向外鼓時，z 值會增加
    const leftCheekDepth = getDepth(leftCheek, leftCheekBone);
    const rightCheekDepth = getDepth(rightCheek, rightCheekBone);
    const avgCheekPuffing = (leftCheekDepth + rightCheekDepth) / 2;

    // 判定是否鼓腮（閾值需調整）
    const isPuffingCheeks = avgCheekPuffing > 0.015;

    // 計算下顎線條放鬆度
    let jawlineRelaxation = 0.5;
    let isJawTight = false;

    if (jawLeft && jawRight && chin && jawLeftMid && jawRightMid) {
        // 計算下顎線條的角度
        // 放鬆時應該是柔和曲線，緊咬時會呈現銳角
        const leftJawAngle = getDistance(jawLeft, jawLeftMid);
        const rightJawAngle = getDistance(jawRight, jawRightMid);
        const chinDistance = getDistance(jawLeftMid, jawRightMid);

        // 簡化計算：柔和曲線時，左右距離和應該較大
        const jawCurvature = (leftJawAngle + rightJawAngle) / (chinDistance + 0.001);

        // 正常範圍約 1.5-2.0
        // 過小（< 1.3）表示咬緊，過大（> 2.2）表示過度放鬆
        jawlineRelaxation = Math.min(Math.max((jawCurvature - 1.0) / 1.5, 0), 1);
        isJawTight = jawCurvature < 1.3;
    }

    return {
        cheekPuffingLeft: leftCheekDepth,
        cheekPuffingRight: rightCheekDepth,
        cheekPuffingAvg: avgCheekPuffing,
        jawlineRelaxation,
        isPuffingCheeks,
        isJawTight,
    };
}

/**
 * 統一接口：根據模式自動選擇監測策略
 */
export function calculateUnifiedEmbouchure(
    keypoints: Keypoint[],
    mode: 'vocal' | 'flute' | 'reed'
): UnifiedEmbouchureMetrics | null {
    if (!keypoints || keypoints.length < 468) return null;

    const metrics: UnifiedEmbouchureMetrics = { mode };

    switch (mode) {
        case 'vocal':
            metrics.vocal = calculateEmbouchure(keypoints);
            break;
        case 'flute':
            metrics.flute = calculateFluteEmbouchure(keypoints);
            break;
        case 'reed':
            metrics.reed = calculateReedEmbouchure(keypoints);
            break;
    }

    return metrics;
}
