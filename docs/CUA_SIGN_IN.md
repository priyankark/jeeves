# CUA-assisted browser sign-in

Available from the browser step's editor and Home's prepared workflow. **Use CUA to sign in** starts the step's selected live provider, even when the workflow run mode is Demo. The browser uses the same local profile as that workflow step.

1. Jeeves opens visible Chrome and navigates toward sign-in.
2. At recognized authentication fields, it stops before taking another screenshot or sending the form to its planner. A planner review also hands control to the user.
3. The user enters account details in Chrome. No browser observation or planner calls continue after handoff.
4. **I’m signed in** closes Chrome and records the user's confirmation. The next workflow accesses the website with that saved session. It does not claim authentication was independently verified.

Assistance supports cancellation, duplicate-start prevention, state recovery after a UI reload, and a two-minute limit on automated navigation. Closing Chrome without confirming retains any saved browser state but reports the sign-in as unconfirmed. Active sign-in assistance blocks starting the same workflow. The editor still offers a manual browser option.

## Evidence

The [live verification](simulation-login-live-verification.json) used real authenticated Codex CLI and visible installed Chrome against a local synthetic store. Codex clicked Sign in and handed over at the password form in **6.793 seconds**. One screenshot was captured before handoff; no screenshot of the authentication form was captured. The human part was simulated with Playwright and a dummy local password. A new browser task reopened the profile and saw the signed-in fixture account.

Regression tests cover persistent login, no planner observation of the recognized credential form, profile locking, explicit confirmation, cancellation while planning, refusing automated account entry, Home handoff and reload recovery, and actionable errors in the editor.

Validation: **86 unit/integration tests** passed. The **27 existing and sign-in UI journeys** passed, and the new workflow-library navigation test passed after correcting its text locator. The packaged Electron smoke test also completed a cart task, handed off sign-in, blocked a concurrent workflow during sign-in, and accepted explicit user confirmation.

The **Workflows** navigation now opens a searchable saved-workflow list at `#workflows`, rather than reopening the last editor. Rows open the selected workflow; the editor breadcrumb and Back return to the library. [Desktop library screenshot](workflow-library-desktop.png) · [CUA control screenshot](cua-sign-in-desktop.png).

## Scope

This is browser-scoped assistance, not arbitrary desktop control. Navigation uses allowed website origins. Complex identity-provider redirects, custom login controls, real retailer authentication, MFA and CAPTCHA have not been validated against real services. Users complete those steps themselves after handoff. A site may reject an automated browser or expire its session.

Browser sign-in does not create a GitHub API credential or authenticate HTTP nodes. Those still use the named API credentials configured in Settings. Browser profiles remain local and are excluded from exported workflow skills.
