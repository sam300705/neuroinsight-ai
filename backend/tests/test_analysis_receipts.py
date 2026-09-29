import base64

import pytest

from neuroinsight_api.analysis_receipts import (
    AnalysisReceiptError,
    ReceiptReplayGuard,
    consume_analysis_receipt,
    issue_analysis_receipt,
)
from neuroinsight_api.schemas import AnalysisMode, AnalysisResponse, Measurement


TEST_SECRET = b"receipt-test-secret-that-is-at-least-thirty-two-bytes"


def reportable_analysis(grad_cam: bytes = b"derived-grad-cam-png") -> AnalysisResponse:
    return AnalysisResponse(
        request_id="test-request",
        scan_id="d1fd69b2-62fa-4cbf-bec2-73fe6d12a6fe",
        mode=AnalysisMode.CLASSIFICATION,
        status="complete",
        model_version="bdneuro-v7-resnet50-head-only-exp005",
        processing_time_ms=4,
        predicted_class="glioma",
        model_confidence_score=0.75,
        calibrated=True,
        manual_review_recommended=True,
        measurement=Measurement(kind="unavailable", metadata_confirmed=False, limitation="Classification produces no segmentation mask or physical measurement."),
        grad_cam_png_base64=base64.b64encode(grad_cam).decode("ascii"),
        warnings=["Experimental image-level academic result."],
        limitations=["Academic and research use only."],
    )


def test_receipt_binds_the_complete_reportable_analysis_and_matching_grad_cam():
    grad_cam = b"derived-grad-cam-png"
    analysis = reportable_analysis(grad_cam)
    receipt = issue_analysis_receipt(analysis, now=1_000, secret=TEST_SECRET)

    verified = consume_analysis_receipt(receipt, grad_cam, now=1_001, secret=TEST_SECRET, replay_guard=ReceiptReplayGuard())

    assert verified.analysis.model_version == "bdneuro-v7-resnet50-head-only-exp005"
    assert verified.analysis.scan_id == analysis.scan_id
    assert verified.analysis.predicted_class == "glioma"


@pytest.mark.parametrize("mutation", [lambda token: token[:-1] + ("A" if token[-1] != "A" else "B"), lambda _token: "v1.invalid.invalid"])
def test_tampered_receipts_fail_closed(mutation):
    receipt = issue_analysis_receipt(reportable_analysis(), now=1_000, secret=TEST_SECRET)
    with pytest.raises(AnalysisReceiptError, match="invalid"):
        consume_analysis_receipt(mutation(receipt), b"derived-grad-cam-png", now=1_001, secret=TEST_SECRET, replay_guard=ReceiptReplayGuard())


def test_expired_and_wrong_secret_receipts_fail_closed():
    receipt = issue_analysis_receipt(reportable_analysis(), now=1_000, secret=TEST_SECRET)
    with pytest.raises(AnalysisReceiptError, match="expired"):
        consume_analysis_receipt(receipt, b"derived-grad-cam-png", now=1_301, secret=TEST_SECRET, replay_guard=ReceiptReplayGuard())
    with pytest.raises(AnalysisReceiptError, match="invalid"):
        consume_analysis_receipt(receipt, b"derived-grad-cam-png", now=1_001, secret=b"wrong-receipt-test-secret-that-is-thirty-two-bytes", replay_guard=ReceiptReplayGuard())


def test_receipts_reject_grad_cam_substitution_and_process_local_replay():
    receipt = issue_analysis_receipt(reportable_analysis(), now=1_000, secret=TEST_SECRET)
    guard = ReceiptReplayGuard()
    with pytest.raises(AnalysisReceiptError, match="invalid"):
        consume_analysis_receipt(receipt, b"substituted-grad-cam", now=1_001, secret=TEST_SECRET, replay_guard=guard)
    consume_analysis_receipt(receipt, b"derived-grad-cam-png", now=1_001, secret=TEST_SECRET, replay_guard=guard)
    with pytest.raises(AnalysisReceiptError, match="replayed"):
        consume_analysis_receipt(receipt, b"derived-grad-cam-png", now=1_002, secret=TEST_SECRET, replay_guard=guard)


def test_mode_b_or_unreportable_analysis_never_receives_a_receipt():
    mode_b = reportable_analysis()
    mode_b.mode = AnalysisMode.SEGMENTATION
    with pytest.raises(AnalysisReceiptError, match="mode"):
        issue_analysis_receipt(mode_b, secret=TEST_SECRET)

    unavailable = reportable_analysis()
    unavailable.status = "unavailable"
    with pytest.raises(AnalysisReceiptError, match="analysis"):
        issue_analysis_receipt(unavailable, secret=TEST_SECRET)
