"""Fail-closed, short-lived integrity receipts for server-issued Mode A reports.

Receipts are HMAC-authenticated and single-use only within the current process.
They are intentionally not described as distributed replay protection or non-repudiation.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import threading
import time
import uuid
from dataclasses import dataclass
from typing import Any

from .schemas import AnalysisMode, AnalysisResponse


RECEIPT_VERSION = "v1"
DEFAULT_RECEIPT_TTL_SECONDS = 300
MAX_RECEIPT_TTL_SECONDS = 900
MIN_RECEIPT_SECRET_BYTES = 32
MAX_CONSUMED_RECEIPTS = 2_048


class AnalysisReceiptError(ValueError):
    """Raised for a public-safe analysis receipt verification failure."""

    def __init__(self, category: str):
        super().__init__(category)
        self.category = category


@dataclass(frozen=True)
class VerifiedAnalysisReceipt:
    analysis: AnalysisResponse
    grad_cam_sha256: str | None
    expires_at: int
    receipt_id: str


class ReceiptReplayGuard:
    """Bounded, process-local single-use guard; not a distributed replay defense."""

    def __init__(self, max_entries: int = MAX_CONSUMED_RECEIPTS):
        self.max_entries = max_entries
        self._consumed: dict[str, int] = {}
        self._lock = threading.Lock()

    def consume_once(self, receipt_id: str, expires_at: int, now: int) -> None:
        with self._lock:
            self._consumed = {key: expiry for key, expiry in self._consumed.items() if expiry > now}
            if receipt_id in self._consumed:
                raise AnalysisReceiptError("replayed")
            if len(self._consumed) >= self.max_entries:
                raise AnalysisReceiptError("replay_guard_full")
            self._consumed[receipt_id] = expires_at


receipt_replay_guard = ReceiptReplayGuard()


def _b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _b64url_decode(value: str) -> bytes:
    if not value or not all(char.isalnum() or char in "-_" for char in value):
        raise AnalysisReceiptError("invalid")
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _configured_secret() -> bytes | None:
    value = os.getenv("ANALYSIS_RECEIPT_SECRET", "")
    secret = value.encode("utf-8")
    return secret if len(secret) >= MIN_RECEIPT_SECRET_BYTES else None


def _configured_ttl_seconds() -> int:
    try:
        configured = int(os.getenv("ANALYSIS_RECEIPT_TTL_SECONDS", str(DEFAULT_RECEIPT_TTL_SECONDS)))
    except ValueError:
        return DEFAULT_RECEIPT_TTL_SECONDS
    return min(MAX_RECEIPT_TTL_SECONDS, max(1, configured))


def _reportable_analysis(analysis: AnalysisResponse) -> dict[str, Any]:
    if analysis.mode is not AnalysisMode.CLASSIFICATION:
        raise AnalysisReceiptError("mode")
    if analysis.model_version != "bdneuro-v7-resnet50-head-only-exp005":
        raise AnalysisReceiptError("model")
    if analysis.status not in {"complete", "low_confidence"} or not analysis.predicted_class:
        raise AnalysisReceiptError("analysis")
    return analysis.model_dump(mode="json", exclude={"analysis_receipt", "grad_cam_png_base64"})


def issue_analysis_receipt(analysis: AnalysisResponse, *, now: int | None = None, secret: bytes | None = None) -> str | None:
    """Return a signed receipt or None when no acceptable signing secret is configured."""
    signing_secret = secret if secret is not None else _configured_secret()
    if signing_secret is None or len(signing_secret) < MIN_RECEIPT_SECRET_BYTES:
        return None
    issued_at = int(time.time()) if now is None else now
    expires_at = issued_at + _configured_ttl_seconds()
    grad_cam = analysis.grad_cam_png_base64
    try:
        grad_cam_sha256 = hashlib.sha256(base64.b64decode(grad_cam, validate=True)).hexdigest() if grad_cam else None
    except Exception as exc:
        raise AnalysisReceiptError("analysis") from exc
    claims = {
        "v": RECEIPT_VERSION,
        "iat": issued_at,
        "exp": expires_at,
        "jti": str(uuid.uuid4()),
        "analysis": _reportable_analysis(analysis),
        "grad_cam_sha256": grad_cam_sha256,
    }
    encoded_claims = _b64url_encode(json.dumps(claims, sort_keys=True, separators=(",", ":")).encode("utf-8"))
    signature = _b64url_encode(hmac.new(signing_secret, encoded_claims.encode("ascii"), hashlib.sha256).digest())
    return f"{RECEIPT_VERSION}.{encoded_claims}.{signature}"


def consume_analysis_receipt(receipt: str, grad_cam: bytes | None, *, now: int | None = None, secret: bytes | None = None, replay_guard: ReceiptReplayGuard | None = None) -> VerifiedAnalysisReceipt:
    """Verify a report receipt, its immutable analysis claims, image hash, expiry, and local single use."""
    signing_secret = secret if secret is not None else _configured_secret()
    if signing_secret is None or len(signing_secret) < MIN_RECEIPT_SECRET_BYTES:
        raise AnalysisReceiptError("signing_unavailable")
    try:
        version, encoded_claims, supplied_signature = receipt.split(".")
        expected_signature = _b64url_encode(hmac.new(signing_secret, encoded_claims.encode("ascii"), hashlib.sha256).digest())
        if version != RECEIPT_VERSION or not hmac.compare_digest(supplied_signature, expected_signature):
            raise AnalysisReceiptError("invalid")
        claims = json.loads(_b64url_decode(encoded_claims).decode("utf-8"))
        if not isinstance(claims, dict) or claims.get("v") != RECEIPT_VERSION:
            raise AnalysisReceiptError("invalid")
        issued_at, expires_at, receipt_id = claims["iat"], claims["exp"], claims["jti"]
        if not isinstance(issued_at, int) or not isinstance(expires_at, int) or not isinstance(receipt_id, str) or not receipt_id:
            raise AnalysisReceiptError("invalid")
        current_time = int(time.time()) if now is None else now
        if issued_at > current_time or expires_at <= current_time or expires_at - issued_at > MAX_RECEIPT_TTL_SECONDS:
            raise AnalysisReceiptError("expired")
        analysis = AnalysisResponse.model_validate(claims["analysis"])
        _reportable_analysis(analysis)
        expected_grad_cam_hash = claims.get("grad_cam_sha256")
        actual_grad_cam_hash = hashlib.sha256(grad_cam).hexdigest() if grad_cam is not None else None
        if expected_grad_cam_hash != actual_grad_cam_hash:
            raise AnalysisReceiptError("invalid")
    except AnalysisReceiptError:
        raise
    except (KeyError, TypeError, ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise AnalysisReceiptError("invalid") from exc
    (replay_guard or receipt_replay_guard).consume_once(receipt_id, expires_at, current_time)
    return VerifiedAnalysisReceipt(analysis=analysis, grad_cam_sha256=expected_grad_cam_hash, expires_at=expires_at, receipt_id=receipt_id)
