import { useCallback, useEffect, useMemo, useState } from "react";
import type { HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { CameraView } from "./components/CameraView";
import { MazeGame, type MazeCommand } from "./components/MazeGame";
import { PermissionGate } from "./components/PermissionGate";
import { PredictionPanel } from "./components/PredictionPanel";
import { SentenceArea } from "./components/SentenceArea";
import { useCamera } from "./hooks/useCamera";
import { useHandLandmarker } from "./hooks/useHandLandmarker";
import { useHoldToCommit } from "./hooks/useHoldToCommit";
import { usePrediction } from "./hooks/usePrediction";
import { useSmoothedPrediction } from "./hooks/useSmoothedPrediction";
import { getHealth } from "./lib/api";
import { useTranslation } from "./lib/i18n";
import { normalizeLandmarks } from "./lib/normalize";

type Mode = "sentence" | "maze";

// Frame-window commit: K matches required out of last N frames at ~10 Hz
// prediction rate. The slider lets users tune the K value (in seconds);
// N is derived to give a small slack for sentence mode and a 2× tolerance
// for maze mode where transitions between U/D/L/R need extra room.
const PREDICTION_HZ = 10;
const SENTENCE_DEFAULT_MS = 1400;
const SENTENCE_MIN_MS = 500;
const SENTENCE_MAX_MS = 3000;
const MAZE_DEFAULT_MS = 200;
const MAZE_MIN_MS = 100;
const MAZE_MAX_MS = 2000;
const HOLD_STEP_MS = 100;
const MIN_CONFIDENCE = 0.4;
const EMA_ALPHA = 0.6;

const SENTENCE_HOLD_KEY = "asl-sentence-hold-ms";
const MAZE_HOLD_KEY = "asl-maze-hold-ms";

function loadHoldMs(key: string, fallback: number, min: number, max: number): number {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  } catch {
    return fallback;
  }
}

// In maze mode the sign-as-pointer mapping (hand pointing in a direction
// triggers the matching ASL letter): B = up, Q = down, H = left, G = right.
const MAZE_LETTER_TO_DIR: Record<string, MazeCommand["letter"]> = {
  B: "U",
  Q: "D",
  H: "L",
  G: "R",
};
const MAZE_LETTER_TO_ARROW: Record<string, string> = {
  B: "↑",
  Q: "↓",
  H: "←",
  G: "→",
};
const MAZE_IGNORE_LABELS = [
  "Blank",
  ..."ACDEFIJKLMNOPRSTUVWXYZ".split(""),
];

export default function App() {
  const { t, lang, setLang } = useTranslation();
  const camera = useCamera();
  const [result, setResult] = useState<HandLandmarkerResult | null>(null);
  const [sentence, setSentence] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [backendOk, setBackendOk] = useState<"checking" | "ok" | "error">(
    "checking",
  );
  const [mode, setMode] = useState<Mode>("sentence");
  const [mazeCommand, setMazeCommand] = useState<MazeCommand | null>(null);
  const [sentenceHoldMs, setSentenceHoldMs] = useState<number>(() =>
    loadHoldMs(SENTENCE_HOLD_KEY, SENTENCE_DEFAULT_MS, SENTENCE_MIN_MS, SENTENCE_MAX_MS),
  );
  const [mazeHoldMs, setMazeHoldMs] = useState<number>(() =>
    loadHoldMs(MAZE_HOLD_KEY, MAZE_DEFAULT_MS, MAZE_MIN_MS, MAZE_MAX_MS),
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(SENTENCE_HOLD_KEY, String(sentenceHoldMs));
    } catch {
      /* ignore quota errors */
    }
  }, [sentenceHoldMs]);
  useEffect(() => {
    try {
      window.localStorage.setItem(MAZE_HOLD_KEY, String(mazeHoldMs));
    } catch {
      /* ignore quota errors */
    }
  }, [mazeHoldMs]);

  // K frames required at ~10 Hz; N = K + slack so the user has a couple
  // of forgiving frames where the prediction can flicker without resetting.
  const sentenceRequired = Math.max(1, Math.round(sentenceHoldMs / (1000 / PREDICTION_HZ)));
  const sentenceWindow = sentenceRequired + 2;
  const mazeRequired = Math.max(1, Math.round(mazeHoldMs / (1000 / PREDICTION_HZ)));
  const mazeWindow = Math.max(mazeRequired + 2, mazeRequired * 2);

  const prediction = usePrediction({ minIntervalMs: 100 });
  const smoothed = useSmoothedPrediction(prediction.response, { alpha: EMA_ALPHA });

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1500);
  }, []);

  const handleCommit = useCallback(
    (label: string) => {
      if (mode === "maze") {
        const dir = MAZE_LETTER_TO_DIR[label];
        if (!dir) return;
        setMazeCommand({ letter: dir, ts: performance.now() });
        return;
      }
      setSentence((s) => s + label);
      showToast(t("sentence.added", { letter: label }));
    },
    [mode, showToast, t],
  );

  const hold = useHoldToCommit(handleCommit, {
    windowSize: mode === "maze" ? mazeWindow : sentenceWindow,
    requiredMatches: mode === "maze" ? mazeRequired : sentenceRequired,
    minConfidence: MIN_CONFIDENCE,
    allowRepeat: mode === "maze",
    ignoreLabels: mode === "maze" ? MAZE_IGNORE_LABELS : ["Blank"],
  });

  // Backend health check on mount.
  useEffect(() => {
    getHealth()
      .then(() => setBackendOk("ok"))
      .catch(() => setBackendOk("error"));
  }, []);

  // Pipe MediaPipe results into prediction + render overlay.
  const onResult = useCallback(
    (res: HandLandmarkerResult) => {
      setResult(res);
      const hand = res.landmarks?.[0];
      if (!hand || hand.length === 0) {
        // No hand → treat as Blank.
        hold.push("Blank", 1.0, performance.now());
        return;
      }
      const features = normalizeLandmarks(hand);
      prediction.submit(features);
    },
    // prediction.submit and hold.push are stable enough; intentionally minimal deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Feed the smoothed top label into the hold tracker. Use raw confidence
  // when the current frame agrees, so the first sample isn't held back by
  // the EMA warmup ramp.
  useEffect(() => {
    if (!smoothed) return;
    const raw = prediction.response;
    let conf = smoothed.confidence;
    if (raw) {
      const rawMatch = raw.topk.find((t) => t.label === smoothed.label);
      if (rawMatch) conf = Math.max(conf, rawMatch.confidence);
    }
    hold.push(smoothed.label, conf, performance.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smoothed]);

  const landmarker = useHandLandmarker({
    videoRef: camera.videoRef,
    onResult,
    enabled: camera.state === "active",
  });

  // Keyboard shortcuts.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA"))
        return;
      if (e.key === " ") {
        e.preventDefault();
        setSentence((s) => s + " ");
      } else if (e.key === "Backspace") {
        setSentence((s) => s.slice(0, -1));
      } else if (e.key === "Escape") {
        setSentence("");
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        if (sentence.length === 0) return;
        navigator.clipboard.writeText(sentence).then(() => showToast(t("sentence.copied")));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sentence, showToast, t]);

  const handleCopy = useCallback(() => {
    if (sentence.length === 0) return;
    navigator.clipboard
      .writeText(sentence)
      .then(() => showToast(t("sentence.copiedClipboard")))
      .catch(() => showToast(t("sentence.copyFailed")));
  }, [sentence, showToast, t]);

  const statusBadge = useMemo(() => {
    if (backendOk === "error")
      return (
        <span className="status error">
          <span className="dot" />
          {t("status.backendOffline")}
        </span>
      );
    if (backendOk === "checking")
      return (
        <span className="status">
          <span className="dot" />
          {t("status.checkingBackend")}
        </span>
      );
    if (landmarker.status === "loading")
      return (
        <span className="status warn">
          <span className="dot" />
          {t("status.loadingModel")}
        </span>
      );
    if (landmarker.status === "error")
      return (
        <span className="status error">
          <span className="dot" />
          {t("status.mediapipeError")}
        </span>
      );
    if (camera.state !== "active")
      return (
        <span className="status warn">
          <span className="dot" />
          {t("status.cameraOff")}
        </span>
      );
    return (
      <span className="status ok">
        <span className="dot" />
        {t("status.live")}
      </span>
    );
  }, [backendOk, landmarker.status, camera.state, t]);

  // Approximate per-commit seconds for the subtitle. With 10 Hz prediction and
  // K-of-N window, fastest commit happens after `requiredMatches` frames.
  const approxSeconds = useMemo(() => {
    const ms = mode === "maze" ? mazeHoldMs : sentenceHoldMs;
    return (ms / 1000).toFixed(1);
  }, [mode, mazeHoldMs, sentenceHoldMs]);

  const currentHoldMs = mode === "maze" ? mazeHoldMs : sentenceHoldMs;
  const holdMinMs = mode === "maze" ? MAZE_MIN_MS : SENTENCE_MIN_MS;
  const holdMaxMs = mode === "maze" ? MAZE_MAX_MS : SENTENCE_MAX_MS;
  const holdDefaultMs = mode === "maze" ? MAZE_DEFAULT_MS : SENTENCE_DEFAULT_MS;
  const setCurrentHoldMs = mode === "maze" ? setMazeHoldMs : setSentenceHoldMs;

  return (
    <div className="app">
      <header className="header">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div>
            <h1>
              {mode === "maze" ? t("app.title.maze") : t("app.title.sentence")}
            </h1>
            <p>
              {mode === "maze"
                ? t("app.subtitle.maze", { seconds: approxSeconds })
                : t("app.subtitle.sentence", { seconds: approxSeconds })}
            </p>
          </div>
          <div className="header-controls">
            <div className="mode-toggle" role="tablist">
              <button
                role="tab"
                aria-selected={mode === "sentence"}
                className={mode === "sentence" ? "active" : ""}
                onClick={() => setMode("sentence")}
              >
                {t("app.mode.sentence")}
              </button>
              <button
                role="tab"
                aria-selected={mode === "maze"}
                className={mode === "maze" ? "active" : ""}
                onClick={() => setMode("maze")}
              >
                {t("app.mode.maze")}
              </button>
            </div>
            <div className="lang-toggle" role="tablist" aria-label="Language">
              <button
                role="tab"
                aria-selected={lang === "pl"}
                className={lang === "pl" ? "active" : ""}
                onClick={() => setLang("pl")}
              >
                PL
              </button>
              <button
                role="tab"
                aria-selected={lang === "en"}
                className={lang === "en" ? "active" : ""}
                onClick={() => setLang("en")}
              >
                EN
              </button>
            </div>
            {statusBadge}
          </div>
        </div>
      </header>

      <div className="settings-strip">
        <div className="settings-row">
          <label className="settings-label" htmlFor="hold-slider">
            {t("settings.holdTime")}
            <span className="settings-value">
              {t("settings.seconds", { seconds: (currentHoldMs / 1000).toFixed(1) })}
            </span>
          </label>
          <div className="settings-slider">
            <span className="settings-endpoint">{t("settings.fast")}</span>
            <input
              id="hold-slider"
              type="range"
              min={holdMinMs}
              max={holdMaxMs}
              step={HOLD_STEP_MS}
              value={currentHoldMs}
              onChange={(e) => setCurrentHoldMs(parseInt(e.target.value, 10))}
            />
            <span className="settings-endpoint">{t("settings.slow")}</span>
            <button
              type="button"
              className="settings-reset"
              onClick={() => setCurrentHoldMs(holdDefaultMs)}
              disabled={currentHoldMs === holdDefaultMs}
            >
              {t("settings.reset")}
            </button>
          </div>
          <p className="settings-hint">{t("settings.holdTime.hint")}</p>
        </div>
      </div>

      {backendOk === "error" && (
        <div className="error-banner">
          {t("error.backend", {
            host: "127.0.0.1:8000",
            cmd: "uvicorn backend.main:app",
          })}
        </div>
      )}
      {landmarker.error && (
        <div className="error-banner">
          {t("error.mediapipe", { message: landmarker.error })}
        </div>
      )}
      {prediction.error && (
        <div className="error-banner">
          {t("error.prediction", { message: prediction.error })}
        </div>
      )}

      <div className="grid">
        <div className="panel">
          <div className="panel-header">
            <span>{t("camera.label")}</span>
            {camera.state === "active" && (
              <button className="panel-header-action" onClick={camera.stop}>
                {t("camera.stop")}
              </button>
            )}
          </div>
          {camera.state === "active" ? (
            <CameraView
              videoRef={camera.videoRef}
              stream={camera.stream}
              result={result}
            />
          ) : (
            <PermissionGate
              state={camera.state}
              error={camera.error}
              onStart={camera.start}
            />
          )}
        </div>

        <div className="panel">
          <PredictionPanel
            currentLabel={smoothed?.label ?? null}
            confidence={smoothed?.confidence ?? 0}
            candidate={hold.candidate}
            progress={hold.progress}
            inFlight={prediction.inFlight}
            inReleaseGate={hold.inReleaseGate}
            topk={smoothed?.topk}
            letterToDirection={mode === "maze" ? MAZE_LETTER_TO_ARROW : undefined}
          />
        </div>
      </div>

      <div className="panel">
        {mode === "sentence" ? (
          <SentenceArea
            sentence={sentence}
            onSpace={() => setSentence((s) => s + " ")}
            onBackspace={() => setSentence((s) => s.slice(0, -1))}
            onClear={() => setSentence("")}
            onCopy={handleCopy}
          />
        ) : (
          <div className="panel-body">
            <MazeGame command={mazeCommand} />
          </div>
        )}
      </div>

      <p className="footnote">
        {mode === "maze"
          ? t("app.footnote.maze")
          : t("app.footnote.sentence", { pct: Math.round(MIN_CONFIDENCE * 100) })}
      </p>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
