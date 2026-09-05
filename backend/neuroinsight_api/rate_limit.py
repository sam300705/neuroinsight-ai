from __future__ import annotations

from collections import deque
from time import monotonic


class FixedWindowRateLimiter:
    """Process-local protection for demo endpoints; not a distributed production control."""

    def __init__(self, window_seconds: int, max_requests: int, max_tracked_keys: int = 2048):
        self.window_seconds = window_seconds
        self.max_requests = max_requests
        self.max_tracked_keys = max_tracked_keys
        self._hits: dict[str, deque[float]] = {}

    def _prune_expired_keys(self, current: float) -> None:
        for key, hits in tuple(self._hits.items()):
            while hits and current - hits[0] >= self.window_seconds:
                hits.popleft()
            if not hits:
                del self._hits[key]

    @property
    def tracked_key_count(self) -> int:
        """Visible for bounded-memory regression checks, not observability claims."""
        return len(self._hits)

    def allow(self, key: str, now: float | None = None) -> tuple[bool, int]:
        current = monotonic() if now is None else now
        if self.max_requests <= 0:
            return False, self.window_seconds
        self._prune_expired_keys(current)
        if key not in self._hits and len(self._hits) >= self.max_tracked_keys:
            return False, max(1, self.window_seconds)
        hits = self._hits.setdefault(key, deque())
        if len(hits) >= self.max_requests:
            retry_after = max(1, int(self.window_seconds - (current - hits[0])) + 1)
            return False, retry_after
        hits.append(current)
        return True, 0
