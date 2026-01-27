import { type Keypoint } from '@tensorflow-models/face-landmarks-detection';

export interface EmbouchureMetrics {
    aperture: number; // Vertical distance between lips
    width: number;    // Horizontal distance between mouth corners
    pucker: number;   // Ratio or other metric to detect "puckering" vs "smiling"
}

// MediaPipe Face Mesh Keypoint Indices
const LANDMARKS = {
    LIP_TOP: 13,
    LIP_BOTTOM: 14,
    MOUTH_LEFT: 61,
    MOUTH_RIGHT: 291,
};

function getDistance(p1: Keypoint, p2: Keypoint): number {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

export function calculateEmbouchure(keypoints: Keypoint[]): EmbouchureMetrics | null {
    if (!keypoints || keypoints.length < 468) return null;

    const lipTop = keypoints[LANDMARKS.LIP_TOP];
    const lipBottom = keypoints[LANDMARKS.LIP_BOTTOM];
    const mouthLeft = keypoints[LANDMARKS.MOUTH_LEFT];
    const mouthRight = keypoints[LANDMARKS.MOUTH_RIGHT];

    if (!lipTop || !lipBottom || !mouthLeft || !mouthRight) return null;

    const aperture = getDistance(lipTop, lipBottom);
    const width = getDistance(mouthLeft, mouthRight);

    // Simple heuristic for pucker: Width / Aperture ratio? 
    // Or just return raw values first.
    // For flute, we want a small aperture (ellipse).

    return {
        aperture,
        width,
        pucker: width / (aperture + 0.001) // Protect div by zero
    };
}
