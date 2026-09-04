"""Bound blocking model inference so API health traffic stays responsive."""

from __future__ import annotations

import asyncio
from typing import Protocol, TypeVar


PredictionT = TypeVar("PredictionT")


class Predictor(Protocol[PredictionT]):
    def predict(self, payload: bytes) -> PredictionT: ...


class InferenceBusyError(RuntimeError):
    """Raised when the process-local inference slot cannot be acquired quickly."""


class InferenceConcurrencyLimiter:
    """Keep CPU inference off the event loop and bound per-process memory pressure."""

    def __init__(self, max_concurrent: int = 1, acquire_timeout_seconds: float = 1.0):
        if max_concurrent < 1 or acquire_timeout_seconds <= 0:
            raise ValueError("Inference concurrency settings must be positive.")
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self.acquire_timeout_seconds = acquire_timeout_seconds

    async def predict(self, classifier: Predictor[PredictionT], payload: bytes) -> PredictionT:
        try:
            await asyncio.wait_for(self._semaphore.acquire(), timeout=self.acquire_timeout_seconds)
        except TimeoutError as exc:
            raise InferenceBusyError("inference capacity is busy") from exc
        try:
            return await asyncio.to_thread(classifier.predict, payload)
        finally:
            self._semaphore.release()


inference_concurrency_limiter = InferenceConcurrencyLimiter()
