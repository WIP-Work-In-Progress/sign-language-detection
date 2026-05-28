import { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

type Status = "idle" | "loading" | "ready" | "error";

interface UseHandLandmarkerOpts {
  videoRef: React.RefObject<HTMLVideoElement>;
  onResult: (result: HandLandmarkerResult, ts: number) => void;
  enabled: boolean;
}

export function useHandLandmarker({
  videoRef,
  onResult,
  enabled,
}: UseHandLandmarkerOpts) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const lastTimestampRef = useRef<number>(0);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    (async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
        if (cancelled) return;
        const lm = await HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.3,
          minHandPresenceConfidence: 0.3,
          minTrackingConfidence: 0.3,
        });
        if (cancelled) {
          lm.close();
          return;
        }
        landmarkerRef.current = lm;
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!enabled || status !== "ready") return;

    let stopped = false;

    const loop = () => {
      if (stopped) return;
      const lm = landmarkerRef.current;
      const video = videoRef.current;
      // Wait until both MediaPipe and the video element are ready.
      if (!lm || !video || video.readyState < 2 || video.videoWidth === 0) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      // MediaPipe requires strictly monotonically increasing timestamps.
      let ts = performance.now();
      if (ts <= lastTimestampRef.current) ts = lastTimestampRef.current + 1;
      lastTimestampRef.current = ts;

      if (video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;
        try {
          const result = lm.detectForVideo(video, ts);
          onResultRef.current(result, ts);
        } catch {
          // swallow transient detection errors; loop continues
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      stopped = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [enabled, status, videoRef]);

  return { status, error };
}
