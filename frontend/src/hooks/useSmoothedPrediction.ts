import { useEffect, useRef, useState } from "react";
import type { PredictResponse, TopKEntry } from "../lib/api";

export interface SmoothedPrediction {
  label: string;
  confidence: number;
  topk: TopKEntry[];
}

interface UseSmoothedPredictionOpts {
  /** EMA weight for the new sample (0..1). Higher = react faster, lower = smoother. */
  alpha?: number;
  /** Per-label confidence below which the entry is dropped from the map. */
  prunePerLabel?: number;
}

/**
 * Maintains a per-label exponential moving average of confidence using each
 * response's topk entries. Labels not present in the current frame's topk
 * decay by (1 - alpha); labels present are pulled toward their new confidence
 * by alpha. Output is the argmax of the smoothed map plus the top-3 slice.
 *
 * This dampens single-frame misclassifications: a letter has to win across a
 * few frames before it surfaces as the smoothed top label.
 */
export function useSmoothedPrediction(
  raw: PredictResponse | null,
  { alpha = 0.4, prunePerLabel = 0.01 }: UseSmoothedPredictionOpts = {},
): SmoothedPrediction | null {
  const mapRef = useRef<Map<string, number>>(new Map());
  const [out, setOut] = useState<SmoothedPrediction | null>(null);
  const lastSeenRef = useRef<PredictResponse | null>(null);

  useEffect(() => {
    if (!raw || raw === lastSeenRef.current) return;
    lastSeenRef.current = raw;

    const m = mapRef.current;
    // Decay all known labels.
    for (const [k, v] of m) {
      const next = v * (1 - alpha);
      if (next < prunePerLabel) m.delete(k);
      else m.set(k, next);
    }
    // Boost labels present in the new topk by their fresh confidence.
    for (const entry of raw.topk) {
      const prev = m.get(entry.label) ?? 0;
      m.set(entry.label, prev + alpha * entry.confidence);
    }

    // Find smoothed top-1 and top-3.
    const entries = [...m.entries()].sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
      setOut(null);
      return;
    }
    const [topLabel, topConf] = entries[0];
    const topk: TopKEntry[] = entries
      .slice(0, 3)
      .map(([label, confidence]) => ({ label, confidence }));
    setOut({ label: topLabel, confidence: topConf, topk });
  }, [raw, alpha, prunePerLabel]);

  return out;
}
