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

## 2026-08-22 — Verified external ONNX Runtime service

The Vercel ONNX Runtime deployment passed HTTPS `/health`, `/ready`, and model-information checks, along with CORS preflight from the exact managed dashboard preview origin. A malformed image upload received HTTP `422`. One lawful public BDNeuro-MRI fixed-split test image then produced a real complete Mode A response with a validation-calibrated model confidence score and real Grad-CAM. The deployment classified that glioma-labelled image as **meningioma** at `0.825931191444397`; this error was retained in the verification record and was not portrayed as diagnostic performance or hidden. The exact response plus real Grad-CAM generated a valid two-page PDF report after an external FPDF layout correction. The external service stores no uploaded MRI image as a dashboard artifact.

## 2026-08-22 — Browser-level upload and result checks

The native file input was changed from a screen-reader-only control to a transparent, browser-targetable control over the upload area. A saved Playwright script injected a corrupted PNG payload, confirmed the signature-error text, and confirmed that **Validate and continue** remained disabled before any inference request. A separate saved Playwright script submitted the same lawful public fixed-split image through the managed dashboard, waited for the results route, and verified the rendered **Experimental academic result**, exact non-diagnostic notice, non-medical confidence wording, and protected-save consent control. Neither browser test asserted class correctness, persisted the original upload, or tested authenticated history retrieval. The latter requires an account session and remains an explicit open verification gate.

The saved accessibility browser check also passed. It used the keyboard to focus and activate the skip-to-main-content link, verified focus reached the `main-content` target, verified the native MRI input has a clear accessible name, and verified corrupted-file feedback is conveyed by visible text alongside the disabled submission state rather than colour alone.

An axe-core/Playwright audit then ran WCAG 2 A/AA rules, including colour contrast, across the eight primary routes. It initially found the small sidebar navigation label at insufficient contrast and a viewport `maximum-scale=1` restriction. The label was changed from `slate-400` to `slate-500`, the zoom restriction was removed, and the full cross-route audit passed with keyboard focus reaching the skip link on every route.

The protected artifact lookup was further tightened in code to verify the requesting account owns the scan record and then issue a fresh signed object-storage download URL. This preserves the no-raw-upload policy and avoids returning a durable storage path directly. At this point in the historical sequence, the authenticated live retrieval interaction had not yet been exercised; the subsequent 2026-08-22 entry records the owner-approved signed-in verification.

The Hindi real-inference browser test passed after the real-result and protected-save UI states were localized. It switched the interface language, submitted the lawful public fixed-split image, and verified Hindi experimental-result and save-consent labels. The exact visible notice **“This system is not a medical diagnosis and must not replace a qualified radiologist.”** remained present as required.

## 2026-08-22 — Authenticated derived-artifact history verification

With the user signed in through the secure dashboard flow and explicit confirmation for the temporary test record, one lawful public fixed-split BDNeuro image completed the live Mode A path. The system saved account-linked pseudonymous result metadata, the server-generated PDF, and the real Grad-CAM overlay while explicitly confirming that the original upload was not stored. The History page listed both derived artifacts. The report action resolved only after the authenticated ownership check and opened a fresh signed URL in the browser PDF viewer. The temporary test record was then deleted, leaving History empty. This proves the protected Mode A artifact workflow; it does not create or validate Mode B segmentation artifacts.

## 2026-08-22 — Published dashboard CORS and live inference check

The dashboard was published at `https://neuroaiapp-gtbxy6cw.manus.space`. The Vercel backend was redeployed with that exact origin plus localhost development origins only. A preflight from the published origin succeeded and an unrelated origin was rejected without an allow-origin header. After the dashboard environment configuration was rebuilt, the saved real-inference browser test passed against the public dashboard. It rendered the real experimental Mode A result and protected-save consent control from the deployed external service. This is a live connectivity verification, not a claim of model correctness, diagnostic use, or authenticated history retrieval.

## 2026-08-27 — PR preview audit and fail-closed remediation

Vercel reported a `READY` Git preview for PR #1 commit `3252cb9` at the time of review. Its `/api/v1/model-info` request nevertheless returned `500 FUNCTION_INVOCATION_FAILED`, while build logs showed no build error. This was treated as a preview-only resilience defect, not as evidence about the already owner-approved managed dashboard release or a production model failure. The branch now catches external-artifact, checksum, metadata, and ONNX-initialization exceptions during startup, logs only the exception type, and exposes an honest unavailable classifier state instead of crashing the function. Final preview verification is required after the branch is pushed; no managed dashboard publication is authorized by this remediation.

## 2026-08-27 — Current public endpoint boundary re-check

The externally configured production inference endpoint returned `status: ok` from `/health` and `ready: true` with the academic non-clinical scope from `/ready`. Its model-information response reported EXP-005 classification as available and segmentation as unavailable. An `OPTIONS` preflight from `https://neuroaiapp-gtbxy6cw.manus.space` returned `200` with that exact `access-control-allow-origin`; an unrelated HTTPS origin returned `400` without an allow-origin header. This re-check covers only the previously published public endpoint, not the unpushed branch changes or the current Vercel PR preview.

## 2026-08-27 — Current-head GitHub Actions verification

GitHub Actions pull-request workflow [`33038209553`](https://github.com/sam300705/neuroinsight-ai/actions/runs/33038209553) completed successfully for branch commit `8d5d02f`. It ran frozen Node installation, TypeScript, Vitest, production build, the 768,000-byte bundle guard, production dependency audit, raw-artifact hygiene scan, the newly added local production-browser corrupt-upload/accessibility/route-accessibility checks, FastAPI tests, and ML/data tests. The GitHub token could not read workflow annotations (`403`), but the job itself completed successfully. This workflow result does not publish the managed dashboard.

The Vercel Git preview for that same commit, deployment `dpl_JDAhZbVBK4xU9gPpcxmmM9YdfZhH`, reached `READY` and returned a structured `200` model-information response instead of the earlier function-invocation failure. It reported both classification and segmentation as `unconfigured`/`unavailable`, which is the intended fail-closed preview state when the branch deployment lacks a usable verified external EXP-005 artifact. This does not change the existing production endpoint, which separately reports EXP-005 classification available, and does not authorize a managed-dashboard publication.

The current public managed dashboard still shows the owner-approved recovery release rather than the branch. It visibly preserves the exact non-diagnostic warning, live Mode A and unavailable Mode B boundaries, but retains the older phrase “Anonymized scan history” on its overview page. The current PR branch corrects that text to account-linked pseudonymous metadata, but publishing that correction requires a separate owner approval. The observed wording is therefore a release-version difference, not evidence that the branch implementation has regressed.

## 2026-08-27 — Final artifact-initialization boundary

The final branch preview deployment `dpl_BkMcnXKW4iVfuEvWh6KXh172fesR` is `READY` and its capability endpoint returns structured `200` data rather than a `500`. It reports both modes unavailable because the startup guard logged `classifier_initialization_failed:error_type=ValueError`. Read-only HTTPS header checks confirmed that the configured ONNX, metadata, and calibration URLs respond successfully; in-memory checks confirmed the committed metadata and calibration SHA-256 values. The 94 MB ONNX checkpoint was not downloaded or replaced because this final review is limited to metadata/manifest verification and must not alter a model artifact. The failure is therefore recorded as an owner-controlled release-readiness gate before any new Vercel production deployment, while the existing production endpoint remains independently available.

## 2026-08-27 — Final PR branch verification

GitHub Actions pull-request run [`33045574801`](https://github.com/sam300705/neuroinsight-ai/actions/runs/33045574801) passed at branch commit `d2441404cdfe6473e05d4c64d3361abcfc068066`. It ran frozen installation, TypeScript, **45** Vitest regressions, production build, the 768,000-byte initial-bundle guard, production dependency audit, raw-artifact hygiene, deterministic local production-browser checks, **25** FastAPI regressions, and **8** ML/data regressions.

The automatic Vercel preview for the same exact branch commit, `dpl_8XSnrDvFQSmTDivXjrMH8MqdAhKh`, reached `READY`. Its deployment-specific `/api/v1/model-info` endpoint returned structured `200` capability data: Mode A remains safely `unconfigured`/`unavailable` under the artifact-initialization gate, and Mode B remains `unconfigured`/`unavailable`. No test uploaded an image, no production target changed, and no managed-dashboard publication occurred.
