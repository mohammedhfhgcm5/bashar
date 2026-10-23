"""Train YOLOv8n on the prepared PECCD split and export ONNX for the Node API.

Tuned for RTX 3050 6GB + Ryzen 5 + 16GB RAM.
Training stays in Python; the API loads ml/weights/peccd-yolov8n.onnx.
"""

from pathlib import Path
import shutil

import torch
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "ml" / "datasets" / "peccd" / "data.yaml"
RUNS = ROOT / "ml" / "runs"
RUN_DIR = RUNS / "peccd-yolov8n"
LAST = RUN_DIR / "weights" / "last.pt"
BEST = RUN_DIR / "weights" / "best.pt"
WEIGHTS = ROOT / "ml" / "weights" / "peccd-yolov8n.onnx"


def main() -> None:
    if not DATA.exists():
        raise SystemExit("Dataset split is missing. Run: node ml/prepare-dataset.js")

    if torch.cuda.is_available():
        torch.backends.cudnn.benchmark = True

    # Continue from last checkpoint if present; otherwise start from yolov8n.
    resume = LAST.exists()
    model = YOLO(str(LAST) if resume else "yolov8n.pt")

    model.train(
        data=str(DATA),
        epochs=40,
        imgsz=640,
        # 32 fit ~3.9GB on RTX 3050 6GB with yolov8n + AMP. Safer than auto.
        batch=32,
        device=0 if torch.cuda.is_available() else "cpu",
        # 2 is enough once cache=ram is warm; fewer Windows spawn issues than 4–8.
        workers=2,
        # ~900 images at 640 fit in ~1GB RAM — fine with 16GB system RAM.
        cache="ram",
        amp=True,
        # Slightly fewer mosaic-heavy epochs near the end → faster + stabler.
        close_mosaic=10,
        project=str(RUNS),
        name="peccd-yolov8n",
        exist_ok=True,
        patience=10,
        resume=resume,
        plots=False,
        verbose=True,
    )

    source = BEST if BEST.exists() else LAST
    if not source.exists():
        raise SystemExit("No trained weights found after training.")

    trained = YOLO(str(source))
    exported = Path(trained.export(format="onnx", imgsz=640, simplify=True, opset=12))
    WEIGHTS.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(exported, WEIGHTS)
    print(f"ONNX ready: {WEIGHTS}")


if __name__ == "__main__":
    main()
