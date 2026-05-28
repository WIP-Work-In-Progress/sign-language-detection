import { useEffect, useRef } from "react";
import type { HandLandmarkerResult } from "@mediapipe/tasks-vision";

const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  stream: MediaStream | null;
  result: HandLandmarkerResult | null;
}

export function CameraView({ videoRef, stream, result }: CameraViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Attach the stream once the <video> element is in the DOM. Splitting this
  // out of useCamera fixes the chicken-and-egg where the hook tried to set
  // srcObject before this component mounted.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    video.play().catch(() => {
      // Autoplay can briefly reject; the next user interaction or metadata
      // event will recover. Nothing actionable here.
    });
  }, [stream, videoRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!result || !result.landmarks?.length) return;

    for (const hand of result.landmarks) {
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 3;
      for (const [a, b] of HAND_CONNECTIONS) {
        const pa = hand[a];
        const pb = hand[b];
        if (!pa || !pb) continue;
        ctx.beginPath();
        ctx.moveTo(pa.x * canvas.width, pa.y * canvas.height);
        ctx.lineTo(pb.x * canvas.width, pb.y * canvas.height);
        ctx.stroke();
      }
      ctx.fillStyle = "#22c55e";
      for (const lm of hand) {
        ctx.beginPath();
        ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const lm of hand) {
        if (lm.x < minX) minX = lm.x;
        if (lm.y < minY) minY = lm.y;
        if (lm.x > maxX) maxX = lm.x;
        if (lm.y > maxY) maxY = lm.y;
      }
      ctx.strokeStyle = "rgba(15,23,42,0.55)";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        minX * canvas.width - 8,
        minY * canvas.height - 8,
        (maxX - minX) * canvas.width + 16,
        (maxY - minY) * canvas.height + 16,
      );
    }
  }, [result, videoRef]);

  return (
    <div className="camera-stage">
      <video ref={videoRef} playsInline muted autoPlay />
      <canvas ref={canvasRef} />
    </div>
  );
}
