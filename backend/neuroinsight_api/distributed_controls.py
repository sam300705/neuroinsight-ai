"""Optional shared rate-limit and receipt-replay state for serverless deployments.

Local development remains credential-free. A deployment that sets
REQUIRE_DISTRIBUTED_CONTROLS=true fails closed unless both Upstash REST
credentials are present and each state-changing operation succeeds.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import re
from collections.abc import Callable
from typing import Any, Protocol

from upstash_redis.asyncio import Redis


RATE_LIMIT_SCRIPT = """
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('TTL', KEYS[1])
return {count, ttl}
""".strip()
NAMESPACE_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]{0,31}$")
logger = logging.getLogger(__name__)


class RedisProtocol(Protocol):
    async def eval(self, script: str, keys: list[str] | None = None, args: list[str] | None = None) -> Any: ...
    async def set(self, key: str, value: str | int, *, nx: bool | None = None, ex: int | None = None) -> Any: ...


class SharedControlUnavailable(RuntimeError):
    """A required shared state operation is unavailable or malformed."""


class SharedReplayDetected(ValueError):
    """A receipt identifier was already recorded by the shared store."""


def _env_flag(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes"}


def _timeout_seconds() -> float:
    try:
        value = float(os.getenv("DISTRIBUTED_CONTROL_TIMEOUT_SECONDS", "1.5"))
    except ValueError:
        return 1.5
    return min(5.0, max(0.2, value))


class SharedControls:
    def __init__(
        self,
        redis: RedisProtocol | None,
        *,
        required: bool,
        namespace: str = "neuroinsight",
        timeout_seconds: float = 1.5,
    ):
        self.redis = redis
        self.required = required
        self.namespace = namespace if NAMESPACE_PATTERN.fullmatch(namespace) else "neuroinsight"
        self.timeout_seconds = min(5.0, max(0.2, timeout_seconds))

    @classmethod
    def from_env(cls) -> "SharedControls":
        required = _env_flag("REQUIRE_DISTRIBUTED_CONTROLS")
        url = os.getenv("UPSTASH_REDIS_REST_URL", "").strip()
        token = os.getenv("UPSTASH_REDIS_REST_TOKEN", "").strip()
        namespace = os.getenv("DISTRIBUTED_CONTROL_NAMESPACE", "neuroinsight").strip().lower()
        redis: RedisProtocol | None = None
        if url.startswith("https://") and token:
            redis = Redis(
                url=url,
                token=token,
                rest_retries=0,
                allow_telemetry=False,
                read_your_writes=True,
            )
        return cls(redis, required=required, namespace=namespace, timeout_seconds=_timeout_seconds())

    @property
    def ready(self) -> bool:
        return not self.required or self.redis is not None

    @property
    def mode(self) -> str:
        if self.redis is not None:
            return "distributed"
        return "required_unconfigured" if self.required else "local"

    def _key(self, kind: str, scope: str, identity: str) -> str:
        safe_scope = re.sub(r"[^a-z0-9_-]", "_", scope.lower())[:32] or "unknown"
        digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()
        return f"{self.namespace}:v1:{kind}:{safe_scope}:{digest}"

    async def allow(
        self,
        *,
        scope: str,
        identity: str,
        window_seconds: int,
        max_requests: int,
        local_fallback: Callable[[], tuple[bool, int]],
    ) -> tuple[bool, int]:
        if self.redis is None:
            if self.required:
                raise SharedControlUnavailable("distributed_rate_limit_unconfigured")
            return local_fallback()
        try:
            raw = await asyncio.wait_for(
                self.redis.eval(
                    RATE_LIMIT_SCRIPT,
                    keys=[self._key("rate", scope, identity)],
                    args=[str(window_seconds)],
                ),
                timeout=self.timeout_seconds,
            )
            if not isinstance(raw, (list, tuple)) or len(raw) != 2:
                raise ValueError("invalid rate-limit response")
            count, ttl = int(raw[0]), int(raw[1])
            if count < 1 or ttl < 0:
                raise ValueError("invalid rate-limit counters")
            return count <= max_requests, 0 if count <= max_requests else max(1, ttl)
        except Exception as exc:
            if self.required:
                raise SharedControlUnavailable("distributed_rate_limit_unavailable") from exc
            logger.warning("shared_control_fallback:rate_limit")
            return local_fallback()

    async def consume_receipt_once(
        self,
        *,
        receipt_id: str,
        expires_at: int,
        now: int,
        local_fallback: Callable[[], None],
    ) -> None:
        ttl = max(1, expires_at - now)
        if self.redis is None:
            if self.required:
                raise SharedControlUnavailable("distributed_replay_guard_unconfigured")
            local_fallback()
            return
        try:
            result = await asyncio.wait_for(
                self.redis.set(self._key("receipt", "report", receipt_id), 1, nx=True, ex=ttl),
                timeout=self.timeout_seconds,
            )
        except Exception as exc:
            if self.required:
                raise SharedControlUnavailable("distributed_replay_guard_unavailable") from exc
            logger.warning("shared_control_fallback:receipt_replay")
            local_fallback()
            return
        if result != "OK":
            raise SharedReplayDetected("replayed")
