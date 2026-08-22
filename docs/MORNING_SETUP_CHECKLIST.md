# Morning Setup Checklist

This checklist contains only actions that cannot be safely completed without the owner or a separately authorised research decision. Do **not** share passwords, tokens, API keys, or patient data in chat.

| Manual action | Why it is needed | Where / permission | Approximate effort | Verification | Security implication |
|---|---|---|---|---|---|
| Restore external technical-supervision API quota, if desired | The requested connection test returned an external `429` quota/billing response. | The owner’s OpenAI account settings; owner-controlled billing/quota only. | Owner-dependent. | Repeat the harmless connection test and record the actual reply. | Never paste API keys into chat or source code. |
| Approve future model promotion | Any newly trained research model must remain separate until its audit, metrics, export checks, and deployment compatibility are reviewed. | Project owner review. | After real experiment results exist. | Compare evidence against the capability manifest before any deployment action. | Prevents an unvalidated model replacing EXP-005. |
| Obtain authorised high-memory/GPU compute, if needed | Full-volume Mode B research cannot be defensibly trained or hosted under the current free serverless constraints. | Institution-approved or user-approved compute only. | Environment-dependent. | Record hardware, run configuration, case-disjoint evaluation, and failure analysis. | Do not upload private MRI or use paid infrastructure without explicit approval. |
| Review public research-data terms before new downloads | Additional sources may require personal acceptance or controlled-access agreements. | Official dataset provider page; owner accepts terms personally. | A few minutes per source. | Retain source, version, licence, and checksum evidence. | Do not accept legal terms on another person’s behalf. |

The present Mode A dashboard needs no manual action for its already verified academic demonstration. Mode B remains unavailable until its separate full-volume evidence gate is met.
