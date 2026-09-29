# Optional Research Explanation Assistant

This component is a **non-clinical research explanation layer**, not an inference, diagnostic, triage, treatment, or report-generation component. It is optional and disabled unless the deployment owner explicitly configures exactly one provider with server-only variables. The default answer path remains the deterministic offline FAQ.

| Property | Implemented requirement |
|---|---|
| Provider selection | `AI_PROVIDER=openai` or `AI_PROVIDER=gemini` selects one provider only; there is no automatic cross-provider retry or switching. |
| Configuration failure | Missing key or missing explicit model identifier disables the external provider and returns the offline FAQ without an external request. |
| Allowed request data | A question of at most 600 characters plus language, purpose, EXP-005 version when present, class, score, calibration/manual-review/Grad-CAM flags, uncertainty reason, and `measurement_available=false`. |
| Prohibited request data | Raw MRI/DICOM/NIfTI, preview, Grad-CAM binary/base64, filename, scan/account/user ID, email, signed URL, storage key, session/auth token, secret, or full analysis object. |
| Provider response | Bounded JSON schema with answer, allowlisted category, medical-refusal status, manual-review reminder, and disclaimer requirement; server validation and post-filtering occur before UI display. The raw REST parser accepts exactly one intended provider text part, never an SDK convenience field or arbitrary tool/system content. |
| OpenAI response extraction | A completed `/v1/responses` object is read only through `output` → an assistant `message` → exactly one `content` part of type `output_text` → its `text` field. |
| Gemini response extraction | A completed `/v1beta/interactions` object is read only through `steps` → exactly one `model_output` → exactly one `content` part of type `text` → its `text` field. |
| Stateless request setting | OpenAI Responses requests and Gemini Interactions requests both include `store: false`. The local application does not intentionally persist assistant conversations. This setting expresses an API request preference; it is not a claim about provider-wide retention commitments. |
| Safety path | Medical advice, diagnosis/treatment/prognosis requests, and prompt-injection requests are refused by deterministic server logic **before** a provider is called. Malformed, timed-out, unsafe, or unavailable provider responses safely return the offline FAQ. |
| Decision boundary | An explanation cannot alter the deterministic classification, calibration, abstention, Grad-CAM output, report, history, or Mode B availability. |

> **Clinical-use restriction:** “This system is not a medical diagnosis and must not replace a qualified radiologist.”

## Structured-output references

The adapters use the official providers’ JSON-schema structured-output mechanisms but validate returned data again with Pydantic because structured generation does not establish factual or medical validity. The OpenAI Responses API documents an `output` list containing assistant-message `content` parts of type `output_text`; the adapter reads only that declared path.[^openai-response] Gemini documents completed Interaction resources with `steps` containing `model_output` text content and documents `store` as an input-only request field; the adapter reads only that declared path and sends `store: false`.[^gemini-interaction]

[^openai-response]: [OpenAI, “Create a model response”](https://developers.openai.com/api/reference/resources/responses/methods/create).
[^gemini-interaction]: [Google AI for Developers, “Gemini Interactions API”](https://ai.google.dev/api/interactions-api).

## Verification boundary

All provider tests inject a mock HTTP transport. Realistic, separate raw REST fixtures cover the OpenAI Responses `output/message/content/output_text` structure and Gemini Interactions `steps/model_output/content/text` structure. They also cover absent/empty/non-completed output, malformed JSON, schema mismatch, irrelevant tool/input metadata, unsafe output fallback, `store: false` in both provider payloads, disabled configuration, selected-provider timeout fallback, and refusal-before-provider-call. No credential was added, no provider was enabled, and no paid or live provider request was made for this implementation.
