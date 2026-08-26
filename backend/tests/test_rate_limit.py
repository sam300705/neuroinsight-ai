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
