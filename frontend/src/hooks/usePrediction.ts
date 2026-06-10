import { useCallback, useEffect, useRef, useState } from "react";
import { predict, type PredictResponse } from "../lib/api";

interface UsePredictionOpts {
  minIntervalMs?: number;
}

interface PredictionState {
  response: PredictResponse | null;
  error: string | null;
  inFlight: boolean;
}

/**
 * Throttled wrapper around POST /predict. The detection loop calls submit()
 * up to ~60fps; we collapse those into one request at a time and at most one
 * per `minIntervalMs` window, keeping the freshest features.
 */
export function usePrediction({ minIntervalMs = 100 }: UsePredictionOpts = {}) {
  const [state, setState] = useState<PredictionState>({
    response: null,
    error: null,
    inFlight: false,
  });

  const inFlightRef = useRef(false);
  const lastFiredRef = useRef<number>(0);
  const lastErrorAtRef = useRef<number>(0);
  const pendingRef = useRef<number[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (features: number[]) => {
    inFlightRef.current = true;
    setState((s) => ({ ...s, inFlight: true }));
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const resp = await predict(features, ctrl.signal);
      setState({ response: resp, error: null, inFlight: false });
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setState((s) => ({ ...s, inFlight: false }));
      } else {
        // Record the error timestamp; the next submit() retries immediately
        // rather than waiting a full minIntervalMs window, so a single
        // failed request doesn't blank the UI for 100ms.
        lastErrorAtRef.current = performance.now();
        setState({
          response: null,
          error: e instanceof Error ? e.message : String(e),
          inFlight: false,
        });
      }
    } finally {
      inFlightRef.current = false;
      lastFiredRef.current = performance.now();
      // If features queued up while a request was in flight, send the latest.
      if (pendingRef.current) {
        const next = pendingRef.current;
        pendingRef.current = null;
        run(next);
      }
    }
  }, []);

  const submit = useCallback(
    (features: number[]) => {
      const now = performance.now();
      const elapsed = now - lastFiredRef.current;
      const justErrored = now - lastErrorAtRef.current < 50;
      if (inFlightRef.current || (elapsed < minIntervalMs && !justErrored)) {
        pendingRef.current = features;
        return;
      }
      run(features);
    },
    [minIntervalMs, run],
  );

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return { ...state, submit };
}
