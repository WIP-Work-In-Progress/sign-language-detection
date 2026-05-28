import { useCallback, useEffect, useRef, useState } from "react";

type CameraState = "idle" | "requesting" | "active" | "denied" | "error";

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>("idle");
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    if (stream) return;
    setState("requesting");
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      });
      setStream(s);
      setState("active");
    } catch (e) {
      const err = e as DOMException;
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setState("denied");
        setError("Camera permission was denied.");
      } else {
        setState("error");
        setError(err.message || "Could not start camera");
      }
    }
  }, [stream]);

  const stop = useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setStream(null);
    setState("idle");
  }, [stream]);

  // Cleanup on unmount.
  const streamRef = useRef(stream);
  streamRef.current = stream;
  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  return { videoRef, state, error, stream, start, stop };
}
