# Security Policy

## Scope and supported versions

Security reports are accepted for the current `main` branch and any actively maintained release branch. Experimental research models, public datasets, and documentation are in scope when a defect could expose secrets, personal data, stored derived artifacts, source uploads, or allow unauthorised actions.

NeuroInsight AI is an academic research demonstration. This policy does **not** claim security certification, HIPAA compliance, GDPR compliance, medical-device status, or clinical suitability.

## Report a vulnerability privately

Do **not** open a public issue for a suspected vulnerability. Do not include passwords, API keys, signed URLs, raw MRI files, personal data, or exploit payloads in public channels.

Use GitHub’s private vulnerability-reporting feature for this repository when it is enabled. If it is not available, an owner must first enable it in the repository’s Security settings or publish an approved private contact channel. Do not send sensitive material until a private channel has been confirmed.

## Information that helps triage

Provide a concise description of the impact, affected component and version/commit, reproduction steps, proof of concept that avoids real data, expected and observed behaviour, suggested mitigation where known, and any relevant logs with secrets removed. Synthetic inputs are preferred.

## Response expectations

Maintainers aim to acknowledge a complete private report within **five business days**, assess severity and reproducibility within **ten business days**, and provide status updates when feasible. These are targets, not a guarantee or service-level agreement. Remediation timing depends on severity, verification, release risk, and owner availability.

## Coordinated disclosure

Please allow maintainers reasonable time to investigate and deploy a fix before public disclosure. Do not access data that you do not own, disrupt the service, bypass authentication, or perform denial-of-service testing. Acknowledgment may be offered only with the reporter’s consent after a fix is available.

## Good-faith research

The project welcomes good-faith testing that follows this policy, stays within accounts and data you are authorised to use, avoids privacy harm and service disruption, and reports findings privately. Nothing here grants legal immunity, authorisation to access systems or data, or permission to violate applicable law or platform terms.
