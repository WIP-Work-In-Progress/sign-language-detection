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

export async function predict(
  features: number[],
  signal?: AbortSignal,
): Promise<PredictResponse> {
  const res = await fetch(`${API_BASE}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ features }),
    signal,
  });
  if (!res.ok) throw new Error(`Predict failed (${res.status})`);
  return res.json();
}
