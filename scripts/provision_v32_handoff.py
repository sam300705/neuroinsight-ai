#!/usr/bin/env python3
"""Verify and extract the private NeuroInsight AI v3.2 handoff ZIP or split ZIP."""

import argparse
import hashlib
import shutil
import stat
import tempfile
import zipfile
from pathlib import Path, PureWindowsPath

EXPECTED_SIZE = 1_120_009_578
EXPECTED_SHA256 = "ef49a170e261dbb434c524f1286f566d54a437e39c80715bb1ca32a691a29653"
PART_SUFFIXES = {".part1", ".part2", ".part3"}
CHUNK_SIZE = 1024 * 1024


def ordered_parts(parts: list[Path]) -> list[Path]:
    by_suffix = {part.suffix: part for part in parts}
    if len(parts) != 3 or by_suffix.keys() != PART_SUFFIXES:
        raise ValueError("Supply exactly one file with each of the .part1, .part2, and .part3 suffixes.")
    return [by_suffix[suffix] for suffix in sorted(PART_SUFFIXES)]


def reconstruct(parts: list[Path], archive: Path, expected_size: int, expected_sha256: str) -> None:
    digest = hashlib.sha256()
    total = 0
    sources = parts if len(parts) == 1 and parts[0].suffix.lower() == ".zip" else ordered_parts(parts)
    with archive.open("xb") as output:
        for part in sources:
            with part.open("rb") as source:
                while chunk := source.read(CHUNK_SIZE):
                    total += len(chunk)
                    if total > expected_size:
                        raise ValueError(f"Handoff exceeds its expected size of {expected_size} bytes.")
                    digest.update(chunk)
                    output.write(chunk)
    if total != expected_size:
        raise ValueError(f"Handoff size mismatch. Expected {expected_size} bytes, got {total}.")
    actual_digest = digest.hexdigest()
    if actual_digest != expected_sha256:
        raise ValueError(f"Handoff SHA-256 mismatch. Got {actual_digest}.")


def archive_entries(archive: zipfile.ZipFile) -> list[tuple[zipfile.ZipInfo, Path]]:
    entries = {}
    for entry in archive.infolist():
        name = entry.orig_filename
        components = name.removesuffix("/").split("/")
        if (
            any(part in {"", ".", ".."} for part in components)
            or "\\" in name
            or "\x00" in name
            or PureWindowsPath(name).drive
        ):
            raise ValueError(f"Unsafe ZIP member path: {name!r}")
        path = Path(*components)
        kind = stat.S_IFMT(entry.external_attr >> 16)
        expected_kind = stat.S_IFDIR if entry.is_dir() else stat.S_IFREG
        if kind not in {0, expected_kind}:
            raise ValueError(f"Unsupported ZIP member type: {name!r}")
        if path in entries:
            raise ValueError(f"Duplicate ZIP member: {name!r}")
        entries[path] = entry

    for path in entries:
        for parent in path.parents:
            if parent in entries and not entries[parent].is_dir():
                raise ValueError(f"ZIP member has a file as its parent: {str(path)!r}")

    return [(entry, path) for path, entry in entries.items()]


def extract_archive(archive_path: Path, destination: Path) -> None:
    with zipfile.ZipFile(archive_path) as archive:
        entries = archive_entries(archive)
        size = sum(entry.file_size for entry, _ in entries)
        if size > shutil.disk_usage(destination).free:
            raise ValueError(f"Insufficient free space to extract {size} bytes.")

        for entry, path in entries:
            target = destination / path
            # Reading to EOF verifies the member CRC, including for directory entries.
            with archive.open(entry) as source:
                if entry.is_dir():
                    if source.read(1):
                        raise ValueError(f"ZIP directory contains data: {entry.filename!r}")
                    target.mkdir(parents=True, exist_ok=True)
                else:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with target.open("xb") as output:
                        shutil.copyfileobj(source, output, length=CHUNK_SIZE)


def provision(
    parts: list[Path],
    output: Path,
    *,
    expected_size: int = EXPECTED_SIZE,
    expected_sha256: str = EXPECTED_SHA256,
) -> None:
    if output.exists() or output.is_symlink():
        raise FileExistsError(f"Choose a new output directory: {output}")
    if expected_size > shutil.disk_usage(output.parent).free:
        raise ValueError(f"Insufficient free space to reconstruct {expected_size} bytes.")

    with tempfile.TemporaryDirectory(prefix=".neuroinsight-v32-", dir=output.parent) as staging:
        workspace = Path(staging)
        archive = workspace / "handoff.zip"
        extracted = workspace / "extracted"
        extracted.mkdir(mode=0o700)
        reconstruct(parts, archive, expected_size, expected_sha256)
        extract_archive(archive, extracted)
        if output.exists() or output.is_symlink():
            raise FileExistsError(f"Output appeared during extraction: {output}")
        extracted.rename(output)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True, help="New directory under a private parent outside the checkout")
    parser.add_argument("parts", nargs="+", type=Path, help="One .zip file or three files with .part1 through .part3 suffixes")
    args = parser.parse_args()
    output = args.output.absolute()
    checkout = Path(__file__).resolve().parent.parent
    if output.resolve().is_relative_to(checkout):
        parser.error("Place the extracted handoff outside the Git checkout.")
    try:
        provision(args.parts, output)
    except (OSError, ValueError, zipfile.BadZipFile, RuntimeError, NotImplementedError) as exc:
        parser.exit(1, f"Handoff provisioning failed: {exc}\n")
    print(f"Verified handoff size, SHA-256 and ZIP integrity. Extracted privately to {output}.")


if __name__ == "__main__":
    main()
