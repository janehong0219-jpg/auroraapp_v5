import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';

export class FaceDetector {
    private detector: faceLandmarksDetection.FaceLandmarksDetector | null = null;

    async init() {
        console.log('Loading Face Mesh model...');
        const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
        const detectorConfig: faceLandmarksDetection.MediaPipeFaceMeshMediaPipeModelConfig = {
            runtime: 'mediapipe', // Use MediaPipe runtime for better performance
            solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
            refineLandmarks: true, // For iris tracking and better lip contours
            maxFaces: 1
        };

        this.detector = await faceLandmarksDetection.createDetector(model, detectorConfig);
        console.log('Face Mesh model loaded.');
    }

    async estimateFaces(video: HTMLVideoElement) {
        if (!this.detector) return null;
        return await this.detector.estimateFaces(video, {
            flipHorizontal: false // We usually flip the video element via CSS
        });
    }
}
