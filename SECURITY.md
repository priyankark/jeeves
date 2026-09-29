# Security

Please report security vulnerabilities through [GitHub's private vulnerability reporting](https://github.com/priyankark/jeeves/security/advisories/new). Include the version, reproduction steps, and likely impact. Do not put working credentials or private task data in the report.

Use [public issues](https://github.com/priyankark/jeeves/issues/new/choose) for ordinary bugs, usability feedback, and feature ideas. Keep security vulnerabilities private while they are investigated.

Jeeves is an early desktop preview. Security fixes target the current preview; older builds are not maintained as separate release branches. Updates are manual.

The local engine binds to loopback. Workflows can send task context to configured model providers and websites. Review imported workflows, prompts, skills, and external actions before running them. Saved credentials use a local file with owner-only permissions; the file is not encrypted. Workflow history and browser sessions can contain sensitive information.
