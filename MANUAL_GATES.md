# Manual Gates

This record lists only actions that cannot be safely automated in the current project. It is not a release approval.

| Gate | Why it is owner-controlled | Exact next action | Risk if skipped |
|---|---|---|---|
| Authorize any next managed-dashboard publication | The Express 5 deployment recovery was already owner-approved and published at checkpoint `409f8a70`. The managed project auto-publishes on checkpoint, while the current PR hardening is a material public change and must not be republished without a fresh owner decision. | Review the current PR #1 head and explicitly authorize a new managed-dashboard publication only if the verified branch changes should become public. | The already-live academic dashboard remains on the prior owner-approved recovery; newer hardening remains PR/preview-only. |
| Protect `main` | The available GitHub integration rejected personal-repository branch-protection payloads containing the documented review restrictions. | In GitHub **Settings → Branches**, protect `main`: require pull requests, require the `verify` check, require conversation resolution, and disallow force pushes/deletions. | A direct push can bypass review and the CI evidence gate. |
| Physical artifact deletion | The managed storage helper does not expose object deletion. Removing metadata/key references makes artifacts unreachable through this application, but does not prove provider-side erasure. | Obtain a provider-supported delete API or approve disabling durable derived-artifact persistence. | Physical-erasure claims cannot be made. |
| Signed dashboard-to-inference authorization | The deployed FastAPI service has no configured shared signing secret or receipt store. | Provision a secret through the deployment platform, add it to both services, and approve a coordinated rollout. | Public inference/report abuse controls and report-tampering resistance remain partial. |
| Full-volume Mode B research | A lawful full-volume cohort, compute, and release evidence are not available in this task. | Review source terms, provide approved compute, then conduct case-disjoint training and locked held-out evaluation under a separate research protocol. | Mode B must remain unavailable. |
| Legal and privacy copy review | Product policy text is engineering draft material, not legal advice. | Have the owner or qualified counsel review privacy, acceptable-use, retention, and collaboration language before public reliance. | Legal or regulatory claims could be misunderstood. |
| Optional technical supervision | The previously configured external service returned HTTP 429. | Restore owner-controlled quota and send the prepared privacy-safe review packet; verify any advice locally. | No external technical review has been received. |

> **Invariant:** “This system is not a medical diagnosis and must not replace a qualified radiologist.”
