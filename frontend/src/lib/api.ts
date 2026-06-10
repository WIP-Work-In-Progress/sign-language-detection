const API_BASE =
  import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";

export interface TopKEntry {
  label: string;
  confidence: number;
}

export interface PredictResponse {
  label: string;
  confidence: number;
  topk: TopKEntry[];
}

export interface HealthResponse {
  status: string;
  model: string;
  num_labels: number;
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`Health check failed (${res.status})`);
  return res.json();
}

export async function getLabels(): Promise<Record<number, string>> {
  const res = await fetch(`${API_BASE}/labels`);
  if (!res.ok) throw new Error(`Labels fetch failed (${res.status})`);
  return res.json();
}

export interface ScoreEntry {
  name: string;
  ms: number;
  rotation: boolean;
  chaser: boolean;
  ts: number;
}

export async function getLeaderboard(): Promise<ScoreEntry[]> {
  const res = await fetch(`${API_BASE}/leaderboard`);
  if (!res.ok) throw new Error(`Leaderboard fetch failed (${res.status})`);
  return res.json();
}

export async function submitScore(
  entry: Omit<ScoreEntry, "ts">,
): Promise<ScoreEntry[]> {
  const res = await fetch(`${API_BASE}/leaderboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error(`Score submit failed (${res.status})`);
  return res.json();
}

export async function predict(
  features: number[],
  signal?: AbortSignal,
): Promise<PredictResponse> {
  // Cap each request at 2s so a hung backend doesn't pile up fetches and
  // trigger the "freeze after a while" symptom on the main thread.
  const timeoutCtrl = new AbortController();
  const timer = window.setTimeout(() => timeoutCtrl.abort(), 2000);
  // Chain any caller-provided abort into the timeout's controller.
  if (signal) signal.addEventListener("abort", () => timeoutCtrl.abort(), { once: true });
  try {
    const res = await fetch(`${API_BASE}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ features }),
      signal: timeoutCtrl.signal,
      // keepalive helps the browser reclaim the socket promptly after abort.
      keepalive: true,
    });
    if (!res.ok) throw new Error(`Predict failed (${res.status})`);
    return res.json();
  } finally {
    window.clearTimeout(timer);
  }
}
