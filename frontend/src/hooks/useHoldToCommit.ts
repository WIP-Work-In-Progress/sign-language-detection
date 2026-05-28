import { useEffect, useRef, useState } from "react";

export interface HoldToCommitOpts {
  /** Size of the sliding frame window. */
  windowSize?: number;
  /** How many of those frames must match the same label to fire commit. */
  requiredMatches?: number;
  /** Minimum confidence for a frame to count (others are recorded as null). */
  minConfidence?: number;
  /** Labels that never commit (e.g. "Blank"). */
  ignoreLabels?: string[];
  /**
   * When true, the same letter can re-fire immediately after committing.
   * Used by the maze game where repeated "R, R, R" inputs are expected.
   */
  allowRepeat?: boolean;
}

interface HoldState {
  candidate: string | null;
  progress: number; // 0..1
  inReleaseGate: boolean;
}

/**
 * Commits a label once K out of the last N frames matched it. The frame
 * window is in frame count, not wall-clock time — at our ~10 Hz prediction
 * rate, N=5/K=3 means "3 same predictions within ~500 ms" before firing.
 *
 * The same label cannot re-fire until either (a) `allowRepeat` is true,
 * (b) a different label takes over the window, or (c) the window goes
 * fully ignored/blank — preventing a single sustained sign from spamming.
 */
export function useHoldToCommit(
  onCommit: (label: string) => void,
  {
    windowSize = 5,
    requiredMatches = 3,
    minConfidence = 0.4,
    ignoreLabels = ["Blank"],
    allowRepeat = false,
  }: HoldToCommitOpts = {},
) {
  const windowRef = useRef<(string | null)[]>([]);
  const lastCommittedRef = useRef<string | null>(null);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  const [state, setState] = useState<HoldState>({
    candidate: null,
    progress: 0,
    inReleaseGate: false,
  });

  const push = (label: string, confidence: number, _ts: number) => {
    const ignored = ignoreLabels.includes(label) || confidence < minConfidence;
    const frame = ignored ? null : label;

    const buf = windowRef.current;
    buf.push(frame);
    while (buf.length > windowSize) buf.shift();

    // Count non-null frames per label.
    const counts = new Map<string, number>();
    for (const f of buf) {
      if (f === null) continue;
      counts.set(f, (counts.get(f) ?? 0) + 1);
    }

    // Fully ignored window → reset release-gate so a fresh sign can commit.
    if (counts.size === 0) {
      lastCommittedRef.current = null;
      setState({ candidate: null, progress: 0, inReleaseGate: false });
      return;
    }

    // Argmax over counts.
    let top = "";
    let topCount = 0;
    for (const [l, c] of counts) {
      if (c > topCount) {
        top = l;
        topCount = c;
      }
    }

    const progress = Math.min(1, topCount / requiredMatches);
    const willCommit = topCount >= requiredMatches;
    const gated =
      !allowRepeat && willCommit && lastCommittedRef.current === top;

    setState({ candidate: top, progress, inReleaseGate: gated });

    if (willCommit && (allowRepeat || lastCommittedRef.current !== top)) {
      lastCommittedRef.current = top;
      onCommitRef.current(top);
      // Wipe window so the user must re-accumulate matches for the next commit.
      windowRef.current = [];
      setState({ candidate: null, progress: 0, inReleaseGate: false });
      if (allowRepeat) lastCommittedRef.current = null;
    } else if (
      lastCommittedRef.current !== null &&
      top !== lastCommittedRef.current
    ) {
      // User moved to a different letter — release-gate is open again.
      lastCommittedRef.current = null;
    }
  };

  const reset = () => {
    windowRef.current = [];
    lastCommittedRef.current = null;
    setState({ candidate: null, progress: 0, inReleaseGate: false });
  };

  return { push, reset, ...state };
}

/**
 * Convenience wrapper that runs a periodic decay step. If no frames have
 * arrived in the last `idleMs`, the window is cleared so the UI doesn't
 * show a stale half-filled bar after the user looks away.
 */
export function useHoldDecay(reset: () => void, lastUpdateMs: number, idleMs = 800) {
  useEffect(() => {
    const id = window.setInterval(() => {
      if (performance.now() - lastUpdateMs > idleMs) reset();
    }, 250);
    return () => window.clearInterval(id);
  }, [lastUpdateMs, idleMs, reset]);
}
