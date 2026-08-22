# Repository Governance and Branch Protection

This project uses an evidence-gated research workflow. Repository controls should protect the public academic demonstration without implying regulatory certification or formal security compliance.

## Recommended owner configuration

| Control | Recommended setting | Why it matters |
|---|---|---|
| Default branch | Require pull requests to `main` | Keeps research and deployment changes reviewable. |
| Required checks | Require the `Verify NeuroInsight AI` workflow | Blocks changes that fail type checks, tests, build, or raw-artifact hygiene. |
| Review | Require at least one approved reviewer after real owner handles are added to `CODEOWNERS` | Reduces accidental self-approval without inventing maintainers today. |
| Force pushes | Disable on `main` | Preserves experiment, audit, and release history. |
| Conversation resolution | Require resolved pull-request conversations | Keeps safety, data, and deployment caveats visible. |
| Private vulnerability reporting | Enable in repository Security settings | Provides a controlled channel for sensitive reports. |

The owner must configure these controls in GitHub. This repository includes safe defaults and templates, but code cannot grant GitHub permissions, assign reviewers, or enable account-level security settings.
