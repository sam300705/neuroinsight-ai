"""Enforce measured line-coverage thresholds for high-risk FastAPI modules."""

from __future__ import annotations

import json
import sys
from pathlib import Path


THRESHOLDS = {
    "neuroinsight_api/analysis_receipts.py": 85.0,
    "neuroinsight_api/research_assistant.py": 90.0,
    "neuroinsight_api/onnx_classifier_runtime.py": 70.0,
    "neuroinsight_api/upload_validation.py": 60.0,
    "neuroinsight_api/app.py": 80.0,
}


def main() -> int:
    report = json.loads(Path("coverage.json").read_text(encoding="utf-8"))
    measured = {
        Path(path).as_posix().split("neuroinsight_api/", 1)[-1]: data["summary"]["percent_covered"]
        for path, data in report["files"].items()
        if "neuroinsight_api/" in Path(path).as_posix()
    }
    failures = []
    for module, threshold in THRESHOLDS.items():
        actual = measured.get(module.removeprefix("neuroinsight_api/"))
        if actual is None or actual < threshold:
            failures.append(f"{module}: {actual if actual is not None else 'missing'}% < {threshold}%")
        else:
            print(f"{module}: {actual:.2f}% >= {threshold:.2f}%")
    if failures:
        print("Critical Python coverage threshold failure:\n" + "\n".join(failures), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
