"""
Deterministic label encoding for the ASL classifier.

The training script (train-model.py) uses sklearn's LabelEncoder, which assigns
indices to classes in alphabetical order. We reproduce that ordering here so
inference is decoupled from any CSV read order.

Classes: 26 letters A-Z + the "Blank" sentinel class. Sorted alphabetically:
    A=0, B=1, Blank=2, C=3, D=4, ..., Z=26
"""

from __future__ import annotations

import json
from pathlib import Path

LABELS: list[str] = sorted(
    [chr(ord("A") + i) for i in range(26)] + ["Blank"]
)


def write_labels_json(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({i: label for i, label in enumerate(LABELS)}, indent=2),
        encoding="utf-8",
    )
