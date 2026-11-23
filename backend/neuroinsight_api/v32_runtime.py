"""Load the verified v3.2 handoff without modifying its source or artifacts."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from types import ModuleType

MODEL_VERSION = "neuroinsight-ai-v3.2"


def file_digest(path: Path) -> str:
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def fold_digest(folder: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(folder.rglob("*")):
        if path.is_symlink() or not (path.is_file() or path.is_dir()):
            raise ValueError("Unsupported entry in segmentation checkpoint")
        if path.is_file():
            member = path.relative_to(folder).as_posix()
            digest.update(json.dumps([member, file_digest(path)]).encode("ascii") + b"\n")
    return digest.hexdigest()


def load_pipeline(models_dir: Path):
    manifest = json.loads(Path(__file__).with_name("v32_artifacts.json").read_text())
    source_path = models_dir.parent / "neuroinsight_pipeline.py"
    source = source_path.read_bytes()
    if hashlib.sha256(source).hexdigest() != manifest["source_sha256"]:
        raise ValueError("v3.2 pipeline source digest mismatch")
    for dirname in ("classifier", "segmentation"):
        if (models_dir / dirname).is_symlink():
            raise ValueError(f"Unexpected symlink in {dirname} model directory")
    for relative, expected in manifest["files"].items():
        path = models_dir / relative
        if path.is_symlink() or file_digest(path) != expected:
            raise ValueError(f"v3.2 artifact digest mismatch: {relative}")
    classifier_dir = models_dir / "classifier"
    for relative in manifest["files"]:
        path = models_dir / relative
        if path.is_relative_to(classifier_dir) and path.suffix in {".h5", ".json"}:
            if list(classifier_dir.rglob(path.name)) != [path]:
                raise ValueError(f"Ambiguous classifier artifact: {relative}")
    segmentation_dir = models_dir / "segmentation"
    expected_folds = set(manifest["folds"])
    discovered_folds = {path.name for path in segmentation_dir.glob("fold*")}
    if discovered_folds != expected_folds:
        raise ValueError("v3.2 requires exactly segmentation folds 0 through 4")
    for name, expected in manifest["folds"].items():
        fold = segmentation_dir / name
        if fold.is_symlink() or fold_digest(fold) != expected:
            raise ValueError(f"v3.2 artifact digest mismatch: {name}")
    for stem in ("final_cfg", "postproc", "uncertainty"):
        if list(segmentation_dir.rglob(f"{stem}.txt")) != [segmentation_dir / f"{stem}.txt"]:
            raise ValueError(f"Ambiguous segmentation configuration: {stem}")
        if next(segmentation_dir.rglob(f"{stem}.json"), None) is not None:
            raise ValueError(f"Unexpected alternate segmentation configuration: {stem}")

    # PyTorch applies this override even when the handoff requests weights_only=False.
    os.environ["TORCH_FORCE_WEIGHTS_ONLY_LOAD"] = "1"
    module = ModuleType("neuroinsight_verified_v32")
    exec(compile(source, str(source_path), "exec"), module.__dict__)

    class VerifiedPipeline(module.NeuroInsightPipeline):
        @staticmethod
        def _build_seg_model(cfg, state):
            model = module.NeuroInsightPipeline._build_seg_model(cfg, state)
            expected = model.state_dict().keys()
            missing = expected - state.keys()
            unexpected = state.keys() - expected
            if missing or unexpected:
                raise ValueError(
                    f"Segmentation state mismatch: {len(missing)} missing and {len(unexpected)} unexpected keys"
                )
            return model

        def warmup(self):
            image = module.np.zeros((256, 256, 3), dtype=module.np.uint8)
            image[64:192, 64:192] = 120
            self.predict(image, explain=True)

    return VerifiedPipeline(models_dir, verbose=False)
