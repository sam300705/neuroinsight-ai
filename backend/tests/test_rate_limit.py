from neuroinsight_api.rate_limit import FixedWindowRateLimiter


def test_fixed_window_limiter_allows_a_bounded_burst_then_returns_retry_after():
    limiter = FixedWindowRateLimiter(window_seconds=60, max_requests=2)
    assert limiter.allow("client", now=100) == (True, 0)
    assert limiter.allow("client", now=101) == (True, 0)
    allowed, retry_after = limiter.allow("client", now=102)
    assert allowed is False
    assert retry_after == 59


def test_fixed_window_limiter_expires_old_requests_and_isolates_keys():
    limiter = FixedWindowRateLimiter(window_seconds=60, max_requests=1)
    assert limiter.allow("first", now=100) == (True, 0)
    assert limiter.allow("second", now=101) == (True, 0)
    assert limiter.allow("first", now=160) == (True, 0)


def test_fixed_window_limiter_prunes_expired_client_keys_on_subsequent_requests():
    limiter = FixedWindowRateLimiter(window_seconds=60, max_requests=1)
    assert limiter.allow("first", now=100) == (True, 0)
    assert limiter.allow("second", now=101) == (True, 0)
    assert limiter.tracked_key_count == 2

    assert limiter.allow("current", now=161) == (True, 0)
    assert limiter.tracked_key_count == 1


def test_fixed_window_limiter_caps_simultaneously_tracked_client_keys():
    limiter = FixedWindowRateLimiter(window_seconds=60, max_requests=1, max_tracked_keys=2)
    assert limiter.allow("first", now=100) == (True, 0)
    assert limiter.allow("second", now=100) == (True, 0)
    assert limiter.allow("third", now=100) == (False, 60)
    assert limiter.tracked_key_count == 2
