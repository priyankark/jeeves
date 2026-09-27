# Live verification — September 26, 2026

These are integration checks using synthetic inputs. The interview findings and support ticket are test fixtures, not collected research or customer data. Timings are observations from this machine, not performance guarantees.

## Configured accounts

- TypeSafe: reused the existing key from the related local Jev project. No key was created or revoked. The key is in this project's gitignored `.env` with mode `0600`.
- Codex: used the existing ChatGPT-backed CLI login. No OpenAI API token was derived from login credentials.
- No OpenAI API or OpenRouter credential was found in the scoped local project configuration check. Their adapters remain available through Settings.
- TypeSafe model listing authenticated successfully and returned `jev-latest` and `jev-preview`.
- Codex login status and an actual generation both succeeded.

## Noul decision and handoff workflow

Run: `4f7ac042-73ae-4155-a717-2c473808b74b` · **Jev + Codex · Live**

1. Codex analyzed supplied synthetic interview findings, distinguishing evidence, hypotheses, and risks.
2. A Markdown handoff file captured that result and the task.
3. Jev `jev-1.13.0` evaluated readiness, returned Noul **0.60**, and took the **review** route. The decision call took **203 ms**, using 1,431 input tokens and 20 output tokens.
4. The writer was skipped; a Codex reviewer processed the handoff.
5. The output node collected the review; the run completed.

A separate small Noul authentication check returned **0.98** and the pass route in **198 ms**.

## Live copilot and Choice workflow

The copilot used the authenticated Codex harness to generate **Support Ticket Triage** with six nodes and seven edges. The full graph passed schema and routing validation before being saved. Proposal generation took **81.5 seconds**; improving this latency remains product work.

Run: `afa88b18-1990-478e-807b-1afdb52a5a22`

1. Jev `jev-1.13.0` classified the synthetic ticket as **technical**, with confidence **1.0** and probabilities `{billing: 0, technical: 1}`.
2. The decision node took **148 ms** including checkpoint overhead.
3. Only the technical specialist ran. Billing and uncertainty-review branches were skipped.
4. Codex produced the specialist response in **10.8 seconds**; the output node completed.

All verified workflow graphs, run snapshots, outputs, and handoff artifacts are in the local workspace. Full keys are absent from source, screenshots, exports, and this report.

## Score workflow

Run: `9e5430a1-09f2-4ad9-b3e2-b4f54f5543f9` · **Release readiness · Jev**

Jev evaluated a synthetic release checklist against three ordered levels. It returned **1.94 / 2**, confidence **0.91**, and probabilities `{0: 0, 1: 0.06, 2: 0.94}`. The pass route was selected; the call took **212 ms** using 597 input tokens and 17 output tokens. This verifies all three Jev primitives against the live service.

## Desktop and automated checks

- **33 engine, integration-contract, connection, and recovery tests** passed.
- **9 browser tests** passed, including checkpoint resume, result download, undo/redo, connection verification, and confirmation before retrying an uncertain POST, and readable JSON output.
- The production desktop was tested with both development servers stopped. It started its own engine and rendered the workspace in **1.33 seconds** with no browser errors and Node integration disabled.
- Closing that desktop stopped the engine it owned. Existing external engines are reused rather than terminated.

## Remaining verification boundaries

- OpenAI API, OpenRouter, and local-model adapters have contract tests, but have not been exercised with live credentials here.
- HTTP actions have runtime limits and mocked coverage; authenticated third-party connector behavior has not been certified.
- No load, multi-user, or cross-platform certification is implied by these checks.

## Desktop evidence

[Verified provider connections](live-connections.png) · [Completed live specialist output](live-output.png)
