import asyncio
import threading

import pytest

from neuroinsight_api.inference_execution import InferenceBusyError, InferenceConcurrencyLimiter


def test_inference_runs_off_event_loop_and_rejects_excess_concurrency():
    started = threading.Event()
    release = threading.Event()

    class SlowClassifier:
        calls = 0

        def predict(self, payload: bytes):
            self.calls += 1
            started.set()
            release.wait(1)
            return payload.decode("ascii")

    async def exercise():
        classifier = SlowClassifier()
        limiter = InferenceConcurrencyLimiter(max_concurrent=1, acquire_timeout_seconds=0.01)
        first = asyncio.create_task(limiter.predict(classifier, b"first"))
        assert await asyncio.to_thread(started.wait, 0.5)

        # This coroutine can still run while prediction blocks in its worker
        # thread, proving inference did not block the service event loop.
        await asyncio.sleep(0)
        with pytest.raises(InferenceBusyError, match="capacity is busy"):
            await limiter.predict(classifier, b"second")

        release.set()
        return await first, classifier.calls

    result, calls = asyncio.run(exercise())
    assert result == "first"
    assert calls == 1


def test_inference_limiter_validates_configuration():
    with pytest.raises(ValueError):
        InferenceConcurrencyLimiter(max_concurrent=0)
    with pytest.raises(ValueError):
        InferenceConcurrencyLimiter(acquire_timeout_seconds=0)


def test_generic_inference_operation_runs_with_arguments_and_keywords():
    async def exercise():
        limiter = InferenceConcurrencyLimiter()
        return await limiter.run(lambda left, *, right: left + right, 20, right=22)

    assert asyncio.run(exercise()) == 42
