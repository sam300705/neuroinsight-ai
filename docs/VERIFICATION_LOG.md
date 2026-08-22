# Visual Verification Log

## 2026-08-21 — Dashboard usability check

The desktop views for the overview, analysis, results, and history routes were captured at 1280×720. The persistent academic-use disclaimer, primary navigation, validation controls, empty-result state, and history filters rendered without visible overlap or clipped content.

The same routes were captured at 375×812. The mobile header retained a visible language switcher and menu trigger; the research-only banner remained visible; cards, upload controls, and unavailable-model states remained within the viewport without horizontal overflow. The screenshots did not exercise a Hindi toggle interaction, so Hindi language-switch interaction remains covered by implementation review and planned automated coverage rather than this visual session.

## 2026-08-21 — FastAPI validation-service smoke test

An isolated FastAPI process was started on `127.0.0.1:8011` with `CORS_ALLOWED_ORIGINS=http://localhost:3000`. The `/health` endpoint returned `status: ok`; `/ready` returned `ready: false` with the explicit no-verified-model reason; and a multipart request labelled as a PNG but containing corrupt bytes returned HTTP `422` with the authoritative image-decode validation message. The temporary process was terminated after the check. This test verifies input validation and honest unavailable-model behavior only; it does not verify model inference.

## 2026-08-21 — Keyboard-navigation shell check

After adding the global skip link, localized navigation-control names, and the focusable main-content target, mobile captures of the overview and analysis routes at 375×812 retained the visible research-use banner, language switcher, menu trigger, headings, scoped mode cards, and upload guidance without layout overlap.

## 2026-08-22 — Real Mode A local inference and report check

The FastAPI service was started temporarily with the local EXP-005 BDNeuro-MRI ResNet50 checkpoint and its validation-only calibration JSON explicitly configured. `/health` returned `status: ok`; `/ready` returned `ready: true` and the non-clinical experimental-scope reason. A public fixed-split BDNeuro-MRI test image was submitted to `/api/v1/classify`; the real response contained `status: complete`, a predicted class, a validation-calibrated model-confidence score, and a 82,885-byte response containing a real Grad-CAM PNG payload. The same unmodified analysis response and its Grad-CAM payload were used to create a 65 KB, two-page PDF through `/api/v1/report`. The temporary process was terminated afterward to avoid retaining a model process in the sandbox. This check establishes local software-path behavior only, not patient-level, external, clinical, or diagnostic validation.

## 2026-08-22 — Browser endpoint configuration check

The development dashboard was configured to the temporary HTTPS local FastAPI proxy. A Vitest health check against the configured public base URL passed. The analysis page loaded with its visible research warning, Mode A scope card, accessible file-picker control, and server-side validation messaging. The automated browser uploader could not address the hidden native file input in this environment even after the visible picker was activated; this is an automation limitation, not a successful browser upload claim. The same request path remains covered by the passing server-response and corrupt-upload client tests plus the local service smoke test.
