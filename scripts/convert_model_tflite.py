"""Convert a Keras .h5 model to a TFLite model.

Run this locally (requires TensorFlow). The output .tflite file is used by
backend/main.py and the backend Docker image.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import tensorflow as tf


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert Keras .h5 to .tflite")
    parser.add_argument(
        "--input",
        default="model/asl_classifier-prod.h5",
        help="Path to the input .h5 model",
    )
    parser.add_argument(
        "--output",
        default="model/asl_classifier-prod.tflite",
        help="Path to the output .tflite model",
    )
    parser.add_argument(
        "--optimize",
        action="store_true",
        help="Enable default TFLite optimizations",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        raise FileNotFoundError(f"Input model not found: {input_path}")

    model = tf.keras.models.load_model(str(input_path))
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    if args.optimize:
        converter.optimizations = [tf.lite.Optimize.DEFAULT]

    tflite_model = converter.convert()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(tflite_model)
    print(f"Wrote {output_path} ({len(tflite_model)} bytes)")


if __name__ == "__main__":
    main()
