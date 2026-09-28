# Input requests in a workflow

**Ask for input** is a real execution step. Add it from the node picker, write the request message and configure questions in the inspector. Field types are short/long text, lists, numbers, yes/no and named choices. Required fields, numeric bounds and US ZIP formatting are validated on the server. The grocery preset collects shopping list, budget, ZIP, restrictions and substitution preference.

The engine finishes the current batch, saves a `waiting` run, and releases its worker. Descendants remain pending. Waiting requests survive restart and are discoverable from Activity even when Home or another workflow is open. Home and the Run panel render the form; Activity opens the Run panel at full-window size. Local drafts survive reload. Submission completes the input node, keeps the same run ID and reuses completed steps. The submitted object is the node output (`previous` / `parents.<node-id>` downstream); the original run input is unchanged. A server lock and request ID reject stale or simultaneous replies. Waiting runs can be cancelled.

Input steps belong in the root workflow. Nested workflows containing them are rejected before execution; collect their input in the parent and pass it on. Forms are configured by workflow authors rather than generated dynamically by the agent. Accounts, passwords and MFA continue to use the separate browser login handoff.

Portable runs emit `status: waiting`, the fields and a checkpoint path. Supply `--resume <checkpoint> --answers <file>` to continue, with a JSON object mapping node IDs to answers. The test suite verifies that an exported grocery workflow pauses before contacting the cart, then continues the same run and makes exactly one fixture-cart addition after receiving answers.

## Verification

- Production TypeScript/Vite/runtime build passed.
- 107 unit/integration checks passed across the full run and updated portable-workflow regression test.
- All 43 browser checks passed, including server validation, concurrent replies, cancellation, draft recovery through Activity, continuation on the original run, and question editing without JSON.
- Manually opened the waiting Amazon demo from Activity using screenshot-guided clicks in visible Chrome. [Form screenshot](usability-audit-2026-09-27/amazon-workflow-input-form.png).
- The preview workspace at `http://127.0.0.1:4328` contains an Amazon grocery workflow with **Your Amazon grocery trip** before the browser step, and a demo run waiting for input. The original installed app and Amazon sign-in at port 4317 were preserved; no real shopping was started.

[Updated Amazon workflow JSON](usability-audit-2026-09-27/amazon-with-input-request.json) can be imported into the updated desktop build. New build: `release/ux-preview/Jeeves-darwin-arm64/Jeeves.app`. Existing desktop windows must be restarted to use the new engine; doing so ends any currently open sign-in handoff.
