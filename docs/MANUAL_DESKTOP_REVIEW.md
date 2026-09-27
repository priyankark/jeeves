# Desktop UI review — September 27, 2026

This was an agent-operated exploratory session in the actual packaged Jeeves Electron window. Library navigation and search were exercised through macOS accessibility controls; further interaction used controls attached to that same visible desktop window. The live runs were started from the UI, not by calling the run API. Read-only API requests collected the saved results afterward. This is not a human usability study.

## Live Jev results

| UI journey | Jev result | Confidence | Route and execution | Decision latency |
| --- | --- | --- | --- | --- |
| Library → Release readiness → Live → Run workflow, using the saved passing fixture | Score 1.95 / 2 | 92% | `pass`; Ready to proceed completed; other branches skipped | 194 ms |
| Run input → change checks to failing tests, three blockers and missing rollback → Run workflow | Score 0 / 2 | 100% | `fail`; Resolve blockers completed; other branches skipped | 128 ms |
| Home → select Support Ticket Triage → enter request → review task input → Run live | Choice `technical` | 100% | Technical specialist completed in 10.636 seconds; billing and review skipped; draft reply shown on Home | 215 ms |

All three runs completed, used **jev-1.13.0**, reported **simulated: false**, and recorded nonzero token usage. Inputs were explicitly synthetic. The support reply distinguished reported facts from a possible server-side cause, avoided repeating troubleshooting already attempted, and did not claim to have fixed or sent anything. The release workflow's original input was restored through the UI after the failing case.

[Saved run evidence](manual-desktop-jev-verification.json) · [Score inspector](manual-desktop-jev-score.png) · [Fail branch](manual-desktop-jev-fail.png) · [Choice inspector](manual-desktop-jev-choice.png) · [Home support result](manual-desktop-support-home.png)

## Other UI checks

- Workflows opened the saved library. Typing Release filtered it to the matching workflow, which opened correctly.
- Explore showed the GitHub maintenance preview, its six steps, provider choice and local-install disclosure. No duplicate installation was made.
- Skills showed the installed internal-comms skill and its six bundled files.
- Schedules opened its creation view and explained engine/sleep requirements. No schedule was created in this session.
- Grocery CUA sign-in with the unchanged example URL reported the missing website permission. A real store URL and site-specific login are still required; no real retailer authentication was attempted.

## Friction reproduced and fixed

**Inspect run silently created a saved replay copy.** Inspecting the support result increased the library count from 10 to 11. This was the source of the repeated support workflows. Inspection now opens an unsaved run snapshot. Selecting nodes, viewing decisions, or leaving for another workflow does not save it. Save a copy, edit, or rerun explicitly creates the editable copy. The desktop revisit kept the count at 11; existing saved copies were retained. Home, history and schedule inspection share this behavior.

**Home's welcome area pushed suggestions off a laptop-sized window.** Reduced vertical spacing below 850 pixels of height. In the actual desktop viewport of 744 pixels, suggestion cards now occupy approximately y=472–652 and are fully visible. [Updated Home](manual-desktop-home-compact.png).

The production build passed. Fifteen relevant UI regression checks covering Home, history/resume, schedules, editor behavior and export passed after the changes. These complement the exploratory session; they are not substituted for it.

These results establish working Jev connectivity, typed responses and correct execution of the selected branches for these cases. They do not establish a general model-accuracy rate, uncertainty calibration, or compatibility with real grocery retailers.
