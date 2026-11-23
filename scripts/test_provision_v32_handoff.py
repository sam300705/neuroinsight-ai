import hashlib
import io
import stat
import tempfile
import unittest
import zipfile
from pathlib import Path

from provision_v32_handoff import provision


class ProvisionHandoffTests(unittest.TestCase):
    def setUp(self):
        self.workspace = tempfile.TemporaryDirectory()
        self.addCleanup(self.workspace.cleanup)
        self.root = Path(self.workspace.name)
        self.output = self.root / "verified"

    def split(self, data: bytes) -> list[Path]:
        third = len(data) // 3
        parts = [self.root / f"Handoff ({number}).zip.part{number}" for number in range(1, 4)]
        for part, segment in zip(parts, (data[:third], data[third:2 * third], data[2 * third:]), strict=True):
            part.write_bytes(segment)
        return list(reversed(parts))

    def archive(self, name="backend/pipeline.py") -> bytes:
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, "w") as archive:
            archive.writestr(name, b"test data")
        return stream.getvalue()

    def provision(self, data: bytes, **overrides) -> None:
        expected = {"expected_size": len(data), "expected_sha256": hashlib.sha256(data).hexdigest()}
        provision(self.split(data), self.output, **(expected | overrides))

    def test_reconstructs_in_suffix_order_and_extracts(self):
        self.provision(self.archive())
        self.assertEqual((self.output / "backend/pipeline.py").read_bytes(), b"test data")
        self.assertEqual(stat.S_IMODE(self.output.stat().st_mode), 0o700)

    def test_size_and_digest_mismatches_leave_no_output(self):
        data = self.archive()
        for overrides in ({"expected_size": len(data) + 1}, {"expected_sha256": "0" * 64}):
            with self.subTest(overrides=overrides), self.assertRaises(ValueError):
                self.provision(data, **overrides)
            self.assertFalse(self.output.exists())

    def test_invalid_zip_integrity_leaves_no_output(self):
        data = self.archive().replace(b"test data", b"bad  data")
        with self.assertRaisesRegex(zipfile.BadZipFile, "CRC"):
            self.provision(data)
        self.assertFalse(self.output.exists())

    def test_rejects_traversal_and_absolute_paths(self):
        for path in ("../escaped", "/absolute", "C:/absolute", "a\\..\\escaped"):
            with self.subTest(path=path), self.assertRaisesRegex(ValueError, "Unsafe ZIP member"):
                self.provision(self.archive(path))
            self.assertFalse(self.output.exists())

    def test_rejects_zip_symlinks(self):
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, "w") as archive:
            link = zipfile.ZipInfo("linked")
            link.create_system = 3
            link.external_attr = (stat.S_IFLNK | 0o777) << 16
            archive.writestr(link, "../outside")
        with self.assertRaisesRegex(ValueError, "Unsupported ZIP member type"):
            self.provision(stream.getvalue())
        self.assertFalse(self.output.exists())

    def test_preserves_existing_output(self):
        self.output.mkdir()
        marker = self.output / "marker"
        marker.write_text("existing")
        with self.assertRaises(FileExistsError):
            self.provision(self.archive())
        self.assertEqual(marker.read_text(), "existing")


if __name__ == "__main__":
    unittest.main()
