# Visual Verification Log

## 2026-08-21 — Dashboard usability check

The desktop views for the overview, analysis, results, and history routes were captured at 1280×720. The persistent academic-use disclaimer, primary navigation, validation controls, empty-result state, and history filters rendered without visible overlap or clipped content.

The same routes were captured at 375×812. The mobile header retained a visible language switcher and menu trigger; the research-only banner remained visible; cards, upload controls, and unavailable-model states remained within the viewport without horizontal overflow. The screenshots did not exercise a Hindi toggle interaction, so Hindi language-switch interaction remains covered by implementation review and planned automated coverage rather than this visual session.

## 2026-08-21 — FastAPI validation-service smoke test

An isolated FastAPI process was started on `127.0.0.1:8011` with `CORS_ALLOWED_ORIGINS=http://localhost:3000`. The `/health` endpoint returned `status: ok`; `/ready` returned `ready: false` with the explicit no-verified-model reason; and a multipart request labelled as a PNG but containing corrupt bytes returned HTTP `422` with the authoritative image-decode validation message. The temporary process was terminated after the check. This test verifies input validation and honest unavailable-model behavior only; it does not verify model inference.
