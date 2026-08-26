from __future__ import annotations

from collections import defaultdict, deque
from time import monotonic


class FixedWindowRateLimiter:
    """Process-local protection for demo endpoints; not a distributed production control."""

    def __init__(self, window_seconds: int, max_requests: int):
        self.window_seconds = window_seconds
        self.max_requests = max_requests
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str, now: float | None = None) -> tuple[bool, int]:
        current = monotonic() if now is None else now
        if self.max_requests <= 0:
            return False, self.window_seconds
        hits = self._hits[key]
        while hits and current - hits[0] >= self.window_seconds:
            hits.popleft()
        if len(hits) >= self.max_requests:
            retry_after = max(1, int(self.window_seconds - (current - hits[0])) + 1)
            return False, retry_after
        hits.append(current)
        return True, 0
