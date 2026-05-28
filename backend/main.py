"""
FastAPI server that exposes the pre-trained ASL classifier as a REST endpoint.

The browser-side client extracts 21 MediaPipe hand landmarks per frame,
normalizes them (x - min(x), y - min(y)), and POSTs the 42-element feature
vector to /predict. We run the saved TFLite model and return the predicted
letter plus confidence.
"""

from __future__ import annotations

import logging
import os
import threading
from contextlib import asynccontextmanager
from pathlib import Path

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .labels import LABELS, write_labels_json

logger = logging.getLogger("asl-backend")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = PROJECT_ROOT / "model" / "asl_classifier-prod.tflite"
LABELS_JSON = Path(__file__).resolve().parent / "labels.json"

NUM_FEATURES = 42
TOPK = 3


class PredictRequest(BaseModel):
    features: list[float] = Field(..., min_length=NUM_FEATURES, max_length=NUM_FEATURES)


class TopKEntry(BaseModel):
    label: str
    confidence: float


class PredictResponse(BaseModel):
    label: str
    confidence: float
    topk: list[TopKEntry]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Defer the LiteRT import so tooling that touches this module doesn't
    # pay the import cost.
    from ai_edge_litert.interpreter import Interpreter

    if not MODEL_PATH.exists():
        raise RuntimeError(f"Model file not found: {MODEL_PATH}")

    logger.info("Loading model from %s", MODEL_PATH)
    interpreter = Interpreter(model_path=str(MODEL_PATH))
    interpreter.allocate_tensors()
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()

    # Sanity-check: model output dim must match label count.
    out_dim = int(output_details[0]["shape"][-1])
    if out_dim != len(LABELS):
        raise RuntimeError(
            f"Model output dim {out_dim} != label count {len(LABELS)}. "
            "Retrain or update labels.py."
        )

    app.state.model = interpreter
    app.state.input_index = int(input_details[0]["index"])
    app.state.output_index = int(output_details[0]["index"])
    app.state.model_lock = threading.Lock()

    write_labels_json(LABELS_JSON)
    logger.info("Loaded %s, %d labels", MODEL_PATH.name, len(LABELS))
    yield


app = FastAPI(title="ASL Sign Detection", version="1.0.0", lifespan=lifespan)

cors_origin_regex = os.environ.get(
    "ASL_CORS_ORIGIN_REGEX",
    r"http://(localhost|127\.0\.0\.1)(:\d+)?",
)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=cors_origin_regex,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model": MODEL_PATH.name, "num_labels": len(LABELS)}


@app.get("/labels")
def labels() -> dict[int, str]:
    return {i: label for i, label in enumerate(LABELS)}


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest) -> PredictResponse:
    model = getattr(app.state, "model", None)
    input_index = getattr(app.state, "input_index", None)
    output_index = getattr(app.state, "output_index", None)
    model_lock = getattr(app.state, "model_lock", None)
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    if input_index is None or output_index is None or model_lock is None:
        raise HTTPException(status_code=503, detail="Model not initialized")

    arr = np.asarray(req.features, dtype=np.float32)
    # NaN/Inf can sneak in if MediaPipe returns a degenerate frame; treat as Blank-ish input.
    arr = np.nan_to_num(arr, nan=0.0, posinf=0.0, neginf=0.0)
    arr = arr.reshape(1, NUM_FEATURES)

    # TFLite interpreters are not thread-safe; serialize access.
    with model_lock:
        model.set_tensor(input_index, arr)
        model.invoke()
        probs = model.get_tensor(output_index)[0]
    top_idx = int(np.argmax(probs))

    order = np.argsort(probs)[::-1][:TOPK]
    topk = [TopKEntry(label=LABELS[int(i)], confidence=float(probs[int(i)])) for i in order]

    return PredictResponse(
        label=LABELS[top_idx],
        confidence=float(probs[top_idx]),
        topk=topk,
    )
