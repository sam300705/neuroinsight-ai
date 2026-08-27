# Optional Research Explanation Assistant

This component is a **non-clinical research explanation layer**, not an inference, diagnostic, triage, treatment, or report-generation component. It is optional and disabled unless the deployment owner explicitly configures exactly one provider with server-only variables. The default answer path remains the deterministic offline FAQ.

| Property | Implemented requirement |
|---|---|
| Provider selection | `AI_PROVIDER=openai` or `AI_PROVIDER=gemini` selects one provider only; there is no automatic cross-provider retry or switching. |
| Configuration failure | Missing key or missing explicit model identifier disables the external provider and returns the offline FAQ without an external request. |
| Allowed request data | A question of at most 600 characters plus language, purpose, EXP-005 version when present, class, score, calibration/manual-review/Grad-CAM flags, uncertainty reason, and `measurement_available=false`. |
| Prohibited request data | Raw MRI/DICOM/NIfTI, preview, Grad-CAM binary/base64, filename, scan/account/user ID, email, signed URL, storage key, session/auth token, secret, or full analysis object. |
| Provider response | Bounded JSON schema with answer, allowlisted category, medical-refusal status, manual-review reminder, and disclaimer requirement; server validation and post-filtering occur before UI display. |
| Safety path | Medical advice, diagnosis/treatment/prognosis requests, and prompt-injection requests are refused by deterministic server logic **before** a provider is called. Malformed, timed-out, unsafe, or unavailable provider responses safely return the offline FAQ. |
| Decision boundary | An explanation cannot alter the deterministic classification, calibration, abstention, Grad-CAM output, report, history, or Mode B availability. |

> **Clinical-use restriction:** “This system is not a medical diagnosis and must not replace a qualified radiologist.”

## Structured-output references

The adapters use the official providers’ JSON-schema structured-output mechanisms but validate returned data again with Pydantic because structured generation does not establish factual or medical validity. OpenAI documents strict JSON-schema output in the Responses API and notes that user-input refusals can require separate handling.[^openai] Gemini documents an Interaction REST request with `response_format` set to JSON MIME type and a schema.[^gemini]

[^openai]: [OpenAI, “Structured Outputs”](https://platform.openai.com/docs/guides/structured-outputs).
[^gemini]: [Google AI for Developers, “Structured output”](https://ai.google.dev/gemini-api/docs/structured-output).

## Verification boundary

All provider tests inject a mock HTTP transport. They cover OpenAI and Gemini structured payloads, no persistence request for OpenAI, strict response validation, disabled configuration, selected-provider timeout fallback, unsafe-output fallback, and refusal-before-provider-call. No credential was added, no provider was enabled, and no paid or live provider request was made for this implementation.
