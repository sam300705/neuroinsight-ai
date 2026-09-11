import asyncio

import pytest

from neuroinsight_api.distributed_controls import SharedControls, SharedControlUnavailable, SharedReplayDetected


class FakeRedis:
    def __init__(self, *, rate_result=None, set_result="OK", error: Exception | None = None):
        self.rate_result = [1, 60] if rate_result is None else rate_result
        self.set_result = set_result
        self.error = error
        self.eval_calls = []
        self.set_calls = []

    async def eval(self, script, keys=None, args=None):
        self.eval_calls.append((script, keys, args))
        if self.error:
            raise self.error
        return self.rate_result

    async def set(self, key, value, *, nx=None, ex=None):
        self.set_calls.append((key, value, nx, ex))
        if self.error:
            raise self.error
        return self.set_result


def test_distributed_rate_limit_is_atomic_and_hashes_the_client_identity():
    redis = FakeRedis(rate_result=[3, 41])
    controls = SharedControls(redis, required=True, namespace="test")

    result = asyncio.run(controls.allow(
        scope="public",
        identity="/api/v1/analyze:203.0.113.8",
        window_seconds=60,
        max_requests=2,
        local_fallback=lambda: (_ for _ in ()).throw(AssertionError("must not fall back")),
    ))

    assert result == (False, 41)
    _, keys, args = redis.eval_calls[0]
    assert args == ["60"]
    assert keys and keys[0].startswith("test:v1:rate:public:")
    assert "203.0.113.8" not in keys[0]


def test_optional_shared_control_failure_uses_the_bounded_local_fallback():
    controls = SharedControls(FakeRedis(error=TimeoutError()), required=False)
    result = asyncio.run(controls.allow(
        scope="assistant", identity="client", window_seconds=60, max_requests=10,
        local_fallback=lambda: (False, 17),
    ))
    assert result == (False, 17)


def test_required_shared_control_is_fail_closed_when_unconfigured_or_unavailable():
    async def exercise(controls):
        await controls.allow(
            scope="public", identity="client", window_seconds=60, max_requests=20,
            local_fallback=lambda: (True, 0),
        )

    assert SharedControls(None, required=True).ready is False
    with pytest.raises(SharedControlUnavailable):
        asyncio.run(exercise(SharedControls(None, required=True)))
    with pytest.raises(SharedControlUnavailable):
        asyncio.run(exercise(SharedControls(FakeRedis(error=OSError()), required=True)))


def test_distributed_receipt_consumption_is_atomic_single_use_with_expiry():
    redis = FakeRedis(set_result="OK")
    controls = SharedControls(redis, required=True, namespace="test")
    asyncio.run(controls.consume_receipt_once(
        receipt_id="receipt-identity", expires_at=1_060, now=1_000,
        local_fallback=lambda: (_ for _ in ()).throw(AssertionError("must not fall back")),
    ))
    key, value, nx, ex = redis.set_calls[0]
    assert key.startswith("test:v1:receipt:report:")
    assert "receipt-identity" not in key
    assert (value, nx, ex) == (1, True, 60)

    redis.set_result = None
    with pytest.raises(SharedReplayDetected):
        asyncio.run(controls.consume_receipt_once(
            receipt_id="receipt-identity", expires_at=1_060, now=1_001,
            local_fallback=lambda: None,
        ))


def test_optional_replay_store_failure_uses_local_guard_but_required_failure_does_not():
    calls = []
    optional = SharedControls(FakeRedis(error=TimeoutError()), required=False)
    asyncio.run(optional.consume_receipt_once(
        receipt_id="receipt", expires_at=10, now=1, local_fallback=lambda: calls.append("local")
    ))
    assert calls == ["local"]

    required = SharedControls(FakeRedis(error=TimeoutError()), required=True)
    with pytest.raises(SharedControlUnavailable):
        asyncio.run(required.consume_receipt_once(
            receipt_id="receipt", expires_at=10, now=1, local_fallback=lambda: calls.append("unsafe")
        ))
    assert calls == ["local"]
