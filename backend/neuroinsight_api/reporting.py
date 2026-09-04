from __future__ import annotations

from io import BytesIO
from datetime import UTC, datetime
from tempfile import NamedTemporaryFile

from fpdf import FPDF
from fpdf.enums import XPos, YPos

from .constants import ACADEMIC_DISCLAIMER, GLIOMA_SCOPE_DISCLAIMER, GRAD_CAM_DISCLAIMER
from .schemas import AnalysisResponse


def _safe_text(value: object | None) -> str:
    return "Unavailable" if value is None or value == "" else str(value)


def build_report(analysis: AnalysisResponse, grad_cam_png: bytes | None = None, segmentation_png: bytes | None = None) -> bytes:
    pdf = FPDF(unit="mm", format="A4")
    pdf.set_compression(False)
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()
    content_width = pdf.w - pdf.l_margin - pdf.r_margin
    pdf.set_font("Helvetica", "B", 18); pdf.cell(0, 10, "NeuroInsight AI Research Report", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_x(pdf.l_margin); pdf.set_font("Helvetica", "B", 11); pdf.set_text_color(150, 45, 10); pdf.multi_cell(content_width, 6, ACADEMIC_DISCLAIMER)
    pdf.set_text_color(0, 0, 0); pdf.ln(2)
    rows = [
        ("Scan UUID", analysis.scan_id), ("Timestamp (UTC)", datetime.now(UTC).isoformat()),
        ("Analysis mode", analysis.mode.value), ("Status", analysis.status), ("Predicted class", analysis.predicted_class),
        ("Model confidence score", analysis.model_confidence_score), ("Calibration status", "Calibrated" if analysis.calibrated else "Not calibrated / unavailable"),
        ("Uncertainty status", analysis.uncertainty_reason), ("Manual review", "Recommended" if analysis.manual_review_recommended else "Not flagged"),
        ("Model version", analysis.model_version), ("Processing time", f"{analysis.processing_time_ms} ms"),
    ]
    pdf.set_font("Helvetica", "B", 12); pdf.cell(0, 8, "Analysis summary", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    for label, value in rows:
        pdf.set_x(pdf.l_margin)
        pdf.set_font("Helvetica", "B", 9); pdf.multi_cell(content_width, 5, f"{label}: {_safe_text(value)}")
    pdf.ln(1); pdf.set_font("Helvetica", "B", 12); pdf.cell(0, 8, "Measurement", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    measure = analysis.measurement
    pdf.set_x(pdf.l_margin); pdf.set_font("Helvetica", "", 9); pdf.multi_cell(content_width, 6, f"Kind: {measure.kind}. Value: {_safe_text(measure.value)} {_safe_text(measure.unit)}. Pixel count: {_safe_text(measure.pixel_count)}. Voxel count: {_safe_text(measure.voxel_count)}. Occupancy: {_safe_text(measure.occupancy_percent)}%. Metadata confirmed: {measure.metadata_confirmed}. Limitation: {measure.limitation}")
    if analysis.mode.value == "segmentation":
        pdf.set_x(pdf.l_margin); pdf.set_text_color(90, 50, 150); pdf.set_font("Helvetica", "B", 9); pdf.multi_cell(content_width, 6, GLIOMA_SCOPE_DISCLAIMER); pdf.set_text_color(0, 0, 0)
    pdf.set_font("Helvetica", "B", 12); pdf.cell(0, 8, "Warnings and technical limitations", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("Helvetica", "", 9)
    for warning in analysis.warnings + analysis.limitations:
        pdf.set_x(pdf.l_margin); pdf.multi_cell(content_width, 5, f"- {warning}")
    if grad_cam_png:
        pdf.add_page(); pdf.set_font("Helvetica", "B", 12); pdf.cell(0, 8, "Grad-CAM attribution", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_x(pdf.l_margin); pdf.set_font("Helvetica", "", 9); pdf.multi_cell(content_width, 6, GRAD_CAM_DISCLAIMER)
        with NamedTemporaryFile(suffix=".png") as temp:
            temp.write(grad_cam_png); temp.flush(); pdf.image(temp.name, w=160)
    if segmentation_png:
        pdf.add_page(); pdf.set_font("Helvetica", "B", 12); pdf.cell(0, 8, "Segmentation overlay", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_x(pdf.l_margin); pdf.set_font("Helvetica", "", 9); pdf.multi_cell(content_width, 6, GLIOMA_SCOPE_DISCLAIMER)
        with NamedTemporaryFile(suffix=".png") as temp:
            temp.write(segmentation_png); temp.flush(); pdf.image(temp.name, w=160)
    return bytes(pdf.output())
