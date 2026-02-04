import { Pose, type Results as PoseResults } from '@mediapipe/pose';

/**
 * 肩膀姿勢指標
 */
export interface ShoulderMetrics {
    isRelaxed: boolean;          // 是否放鬆
    tensionLevel: number;         // 緊張程度 (0-100)
    leftShoulderHeight: number;   // 左肩高度（耳朵-肩膀距離）
    rightShoulderHeight: number;  // 右肩高度
    message?: string;             // 提示訊息
}

/**
 * 姿勢偵測器 - 監測肩膀放鬆狀態
 * 原理：透過監測耳朵到肩膀的垂直距離來判斷是否聳肩
 * - 首次檢測時記錄基線（放鬆狀態）
 * - 後續比對距離變化，減少 15% 以上視為聳肩
 */
export class PostureDetector {
    private pose: Pose | null = null;
    private baselineDistance: number | null = null;  // 基線距離（放鬆狀態）
    private isInitialized: boolean = false;

    /**
     * 初始化 MediaPipe Pose
     */
    async init(): Promise<void> {
        if (this.isInitialized) return;

        this.pose = new Pose({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
            }
        });

        this.pose.setOptions({
            modelComplexity: 1,           // 模型複雜度 (0, 1, 2)
            smoothLandmarks: true,         // 平滑關鍵點
            enableSegmentation: false,     // 不需要分割
            minDetectionConfidence: 0.5,   // 最小檢測置信度
            minTrackingConfidence: 0.5     // 最小追蹤置信度
        });

        this.isInitialized = true;
        console.log('✅ PostureDetector initialized');
    }

    /**
     * 檢測肩膀姿勢
     * @param videoElement 視訊元素
     * @returns 肩膀指標或 null
     */
    async detect(videoElement: HTMLVideoElement): Promise<ShoulderMetrics | null> {
        if (!this.pose || !this.isInitialized) {
            console.warn('⚠️ PostureDetector not initialized');
            return null;
        }

        console.log('🎥 PostureDetector.detect() called');

        return new Promise((resolve) => {
            if (!this.pose) {
                console.error('❌ Pose is null in promise');
                resolve(null);
                return;
            }

            this.pose.onResults((results: PoseResults) => {
                console.log('📸 Pose results received:', {
                    hasLandmarks: !!results.poseLandmarks,
                    landmarkCount: results.poseLandmarks?.length || 0
                });
                const metrics = this.analyzePose(results);
                resolve(metrics);
            });

            this.pose.send({ image: videoElement }).catch((error) => {
                console.error('❌ Error sending image to pose:', error);
                resolve(null);
            });
        });
    }

    /**
     * 分析姿勢結果
     */
    private analyzePose(results: PoseResults): ShoulderMetrics | null {
        if (!results.poseLandmarks || results.poseLandmarks.length === 0) {
            console.warn('⚠️ No pose landmarks detected');
            return null;
        }

        console.log('✅ Pose landmarks detected, count:', results.poseLandmarks.length);

        const landmarks = results.poseLandmarks;

        // 關鍵點索引（MediaPipe Pose Landmarks）
        const LEFT_SHOULDER = 11;
        const RIGHT_SHOULDER = 12;
        const LEFT_EAR = 7;
        const RIGHT_EAR = 8;

        const leftShoulder = landmarks[LEFT_SHOULDER];
        const rightShoulder = landmarks[RIGHT_SHOULDER];
        const leftEar = landmarks[LEFT_EAR];
        const rightEar = landmarks[RIGHT_EAR];

        // 檢查關鍵點是否存在
        if (!leftShoulder || !rightShoulder || !leftEar || !rightEar) {
            return null;
        }

        // 計算耳朵到肩膀的垂直距離（y 座標差異）
        const leftDistance = Math.abs(leftEar.y - leftShoulder.y);
        const rightDistance = Math.abs(rightEar.y - rightShoulder.y);
        const avgDistance = (leftDistance + rightDistance) / 2;

        // 首次檢測：記錄基線（假設用戶處於放鬆狀態）
        if (this.baselineDistance === null) {
            this.baselineDistance = avgDistance;
            console.log(`📏 基線距離已設定: ${avgDistance.toFixed(4)}`);

            return {
                isRelaxed: true,
                tensionLevel: 0,
                leftShoulderHeight: leftDistance,
                rightShoulderHeight: rightDistance,
                message: '基線已校準'
            };
        }

        // 計算距離變化百分比
        const decreasePercent = ((this.baselineDistance - avgDistance) / this.baselineDistance) * 100;

        // 判斷是否聳肩（距離減少 15% 以上）
        const isRelaxed = decreasePercent < 15;

        // 緊張程度：0-100（距離減少越多，緊張度越高）
        const tensionLevel = Math.max(0, Math.min(100, decreasePercent * 2));

        // Debug 日誌
        if (Math.random() < 0.1) { // 10% 的幀輸出日誌
            console.log(`💆 肩膀狀態: ${isRelaxed ? '✅ 放鬆' : '⚠️ 緊張'} | 變化: ${decreasePercent.toFixed(1)}% | 緊張度: ${tensionLevel.toFixed(0)}`);
        }

        return {
            isRelaxed,
            tensionLevel,
            leftShoulderHeight: leftDistance,
            rightShoulderHeight: rightDistance,
            message: isRelaxed ? '肩膀放鬆' : '請放下肩膀'
        };
    }

    /**
     * 重置基線（重新校準）
     */
    resetBaseline(): void {
        this.baselineDistance = null;
        console.log('🔄 基線已重置');
    }

    /**
     * 清理資源
     */
    dispose(): void {
        if (this.pose) {
            this.pose.close();
            this.pose = null;
        }
        this.isInitialized = false;
        this.baselineDistance = null;
        console.log('🗑️ PostureDetector disposed');
    }
}
