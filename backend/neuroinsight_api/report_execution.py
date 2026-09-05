"""Bound PDF generation so report work cannot stall the API event loop."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator


class ReportBusyError(RuntimeError):
    """Raised when report-generation capacity cannot be acquired promptly."""


class ReportConcurrencyLimiter:
    """A process-local admission boundary for memory-heavy PDF generation."""

    def __init__(self, max_concurrent: int = 1, acquire_timeout_seconds: float = 1.0):
        if max_concurrent < 1 or acquire_timeout_seconds <= 0:
            raise ValueError("Report concurrency settings must be positive.")
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self.acquire_timeout_seconds = acquire_timeout_seconds

    @asynccontextmanager
    async def slot(self) -> AsyncIterator[None]:
        try:
            await asyncio.wait_for(self._semaphore.acquire(), timeout=self.acquire_timeout_seconds)
        except TimeoutError as exc:
            raise ReportBusyError("report capacity is busy") from exc
        try:
            yield
        finally:
            self._semaphore.release()


report_concurrency_limiter = ReportConcurrencyLimiter()
