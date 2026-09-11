import asyncio
import warnings

import pytest

from neuroinsight_api.report_execution import ReportBusyError, ReportConcurrencyLimiter
from neuroinsight_api.reporting import build_report
from neuroinsight_api.schemas import AnalysisResponse, Measurement


def test_report_slot_is_bounded_and_released_after_use():
    async def exercise():
        limiter = ReportConcurrencyLimiter(max_concurrent=1, acquire_timeout_seconds=0.01)
        entered = asyncio.Event()
        release = asyncio.Event()

        async def first_report():
            async with limiter.slot():
                entered.set()
                await release.wait()

        first = asyncio.create_task(first_report())
        await entered.wait()
        with pytest.raises(ReportBusyError, match="capacity is busy"):
            async with limiter.slot():
                pytest.fail("busy report slot must not be entered")
        release.set()
        await first

        async with limiter.slot():
            return True

    assert asyncio.run(exercise()) is True


def test_report_limiter_validates_configuration():
    with pytest.raises(ValueError):
        ReportConcurrencyLimiter(max_concurrent=0)
    with pytest.raises(ValueError):
        ReportConcurrencyLimiter(acquire_timeout_seconds=0)


def test_report_builder_uses_current_fpdf_api_without_deprecation_warnings():
    analysis = AnalysisResponse(
        request_id="report-api-test",
        scan_id="d1fd69b2-62fa-4cbf-bec2-73fe6d12a6fe",
        mode="classification",
        status="low_confidence",
        model_version="bdneuro-v7-resnet50-head-only-exp005",
        processing_time_ms=4,
        manual_review_recommended=True,
        measurement=Measurement(
            kind="unavailable",
            metadata_confirmed=False,
            limitation="Classification produces no physical measurement.",
        ),
        warnings=["Experimental academic result."],
        limitations=["Academic and research use only."],
    )

    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always", DeprecationWarning)
        result = build_report(analysis)

    assert result.startswith(b"%PDF")
    assert not [warning for warning in caught if issubclass(warning.category, DeprecationWarning)]
