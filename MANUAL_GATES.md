# Manual / Owner-Controlled Gates

This file lists only work that cannot be honestly completed from repository code and credential-free automated verification. It is not a release approval.

> **This system is not a medical diagnosis and must not replace a qualified radiologist.**

| Gate | Current state | Required owner action | Why it cannot be marked complete here |
|---|---|---|---|
| Protect `main` | **Open** — fresh repository read reports `protected: false` | Require PRs, the `verify` check, review/conversation resolution, and disallow force-push/deletion as appropriate | Repository-settings/admin boundary |
| Managed DB migration | **Open** | Backup/snapshot, run `docs/MIGRATIONS.md` preflight, then apply `0004` → `0005` → `0006` in order | Requires the real managed database and deployment window |
| Dashboard identity/session signing | **Open for a new publication** | Configure real platform `VITE_APP_ID` and strong server-only `JWT_SECRET`; verify sign-in, expiry, logout, cross-app rejection, restart | Real secret/platform identity must not be fabricated or exposed |
| Report signing | **Open if reports are enabled** | Configure strong server-only `ANALYSIS_RECEIPT_SECRET`; verify classify → receipt → PDF and replay/tamper/expiry rejection | Preview correctly fails closed without the secret |
| Managed artifact lifecycle | **Open** | With synthetic non-patient data, save → replace → download → delete; verify object is gone; exercise reconciliation after simulated failure | Unit/CI tests cannot prove the provider's physical erasure behavior |
| Distributed abuse/replay controls | **Open if multi-instance guarantees are claimed** | Provision approved shared state, configure `REQUIRE_DISTRIBUTED_CONTROLS=true`, verify cross-instance limiting/replay/outage behavior and spend controls | Requires provisioned external infrastructure |
| Operational alerts/retention | **Open** | Define SLOs/recipients/retention; configure alerts/drain; trigger staged 5xx/latency failure and verify redaction/delivery | Operational ownership decision and external service |
| Managed-dashboard publication | **Not performed** | Explicitly authorize a new publication after reviewing PR #1 | Existing project policy requires a separate owner release decision |
| Vercel production promotion | **Not performed** | Explicitly authorize promotion after exact-head verification and configuration gates | Production release decision |
| PR #1 merge | **Not performed** | Review exact head and explicitly merge/authorize merge | Branch/release ownership decision |
| Voice transcription | **Unavailable by default** | Keep disabled unless needed; if enabled, configure exact allowed storage hosts/egress and run lawful non-production size/timeout/deletion checks | Provider and data-flow configuration |
| Mode B segmentation | **Intentionally unavailable** | Complete lawful full-volume case-disjoint training/evaluation, uncertainty/artifact verification, and separate release decision | Required research evidence does not exist in the repository |
| Clinical / patient-level claims | **Not permitted by current evidence** | Conduct appropriate independent/external validation and qualified review before any stronger claim | Cannot be manufactured through engineering tests |
| Legal/privacy wording | **Engineering draft** | Qualified owner/counsel review before relying on regulatory/legal claims | Legal-review boundary |

## Current code-owned deletion behavior

The previous documentation said provider objects were deleted before metadata and that metadata was retained when provider deletion failed. That is no longer the final design.

The final design records durable owner-scoped cleanup intents and removes owned metadata **inside the database transaction**, then deletes real provider objects **after commit**. Provider failure leaves the cleanup intent incomplete; the automatic/admin reconciliation path retries it. This avoids holding database locks during storage network calls while retaining durable cleanup responsibility.

## Release rule

Do not describe the project as fully production-approved or clinically validated until the applicable gates above are completed and evidenced. For its declared non-clinical academic scope, the repository can be treated as a code-complete release candidate once exact-head CI is green.
