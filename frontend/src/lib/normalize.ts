/**
 * Mirrors the normalization in real-time-prediciton.py:
 *   data_aux[i*2]   = x_i - min(x_array)
 *   data_aux[i*2+1] = y_i - min(y_array)
 *
 * The MediaPipe HandLandmarker normalizes coordinates to [0, 1] of the input
 * frame, matching the MediaPipe Python solution used during training. We then
 * shift each landmark by the hand's bounding-box minimum, so the model sees a
 * position-invariant hand shape.
 */

export interface XY {
  x: number;
  y: number;
}

export const FEATURE_LENGTH = 42;
export const NUM_LANDMARKS = 21;

export function normalizeLandmarks(landmarks: XY[]): number[] {
  const out = new Array<number>(FEATURE_LENGTH).fill(0);
  if (landmarks.length === 0) return out;

  let minX = Infinity;
  let minY = Infinity;
  for (const lm of landmarks) {
    if (lm.x < minX) minX = lm.x;
    if (lm.y < minY) minY = lm.y;
  }

  const count = Math.min(landmarks.length, NUM_LANDMARKS);
  for (let i = 0; i < count; i++) {
    out[i * 2] = landmarks[i].x - minX;
    out[i * 2 + 1] = landmarks[i].y - minY;
  }
  return out;
}

export function boundingBox(landmarks: XY[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} | null {
  if (landmarks.length === 0) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const lm of landmarks) {
    if (lm.x < minX) minX = lm.x;
    if (lm.y < minY) minY = lm.y;
    if (lm.x > maxX) maxX = lm.x;
    if (lm.y > maxY) maxY = lm.y;
  }
  return { minX, minY, maxX, maxY };
}
