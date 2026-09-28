# Manual usability audit — September 27, 2026

This is an agent-led exploratory walkthrough, not research with recruited participants. Interactions were chosen from screenshots and performed with mouse coordinates, typing, keys, and scrolling in visible Chrome. Rendered page text was also captured. Existing automated tests were not used as evidence of usability. No product code was changed during this pass.

Initial viewport: 1366 × 900; one resize check at 1100 × 760. The first journeys used an isolated fresh Jeeves workspace at localhost:4328. The user then directed the audit toward building and exercising a real Amazon grocery shopper in the installed workspace at localhost:4317. That task is still in progress.

## Observations

| Priority | Finding and observed evidence | Suggested change |
| --- | --- | --- |
| High | **Conversational refinement loses the original task in Demo.** Requested research on local AI tools for a small design team, ran a demo, then said “Keep it under 200 words and focus on tools that run on a Mac.” The new Task field contained only the follow-up. [Screenshot](05-conversation-followup.png). Live refinement has not been tested. | Merge refinements with existing task input; show what changed. |
| High | **An old successful result remains under a new, unrun proposal.** The refined task appears above “Your result is ready” and the original output without a clear previous-run distinction. [Screenshot](05-conversation-followup.png). | Associate results visibly with the request/revision that produced them; label old results and show the current proposal as not run. |
| High | **The editor initially makes a five-step graph unreadably small.** Node labels occupy a tiny strip across a mostly empty canvas. Both navigation columns, the copilot panel, and large headers consume space. [Initial editor](20-editor-first-look.png), [completed run](28-completed-live-result.png). A resize to 1100 × 760 also hides the rightmost nodes until the user fits the graph again. | Use a readable starting zoom and compact/vertical layouts for small workflows; make panels collapsible and adapt the graph on resize. |
| High | **A basic writing task requires JSON in the editor.** Home supplied labeled task fields, but opening an installed template's Run input exposed JSON only. Entering a natural-language task produced “Workflow input must be valid JSON.” [Input](21-writer-task-input.png), [error](22-plain-input-error.png). | Reuse the structured task form in the editor; keep JSON as an advanced option. |
| Medium | **Connecting a provider does not make an existing starter usable.** Codex verified successfully, while Research to brief still required OpenAI and TypeSafe. Provider adaptation exists in Explore's install dialog but is not offered at the blocked run. [Verified provider](13-provider-connected.png), [install choice](17-install-provider-choice.png). | Offer agent-provider adaptation at the blocker; explain separately when a decision step requires TypeSafe. |
| Medium | **Installing a bundled starter creates indistinguishable names.** Draft & review was already in the fresh library. Installing a Codex copy produced two entries named Draft & review. Their order also changed after save. [Installed](18-template-installed.png), [editor sidebar](21-writer-task-input.png). | Recognize installed starters, offer Open/customize/duplicate explicitly, and label copies with meaningful names or provider metadata. |
| Medium | **Demo completion supplies implementation details instead of an illustrative task result.** The success card contains prompt text, “Assigned skills: None,” and “Connected context received from: gate.” It is honestly labeled simulated, but does little to demonstrate the outcome a newcomer came for. [Screenshot](04-demo-result-and-followup.png). | Show a clearly labeled representative result and a concise execution preview; move internals to inspection. |
| Medium | **Developer vocabulary leaks into basic task setup.** “Demo Jev Value,” “0 assigned skills,” and raw provider names appear during a simple research request. A workflow with no decision node still shows the generic demo_jev_value hint in Run input. [Home](02-newcomer-natural-request.png), [writing input](21-writer-task-input.png). | Hide optional debugging controls; describe requirements in terms relevant to the current task. |
| Low | **The install success state pushes its next action below the modal viewport.** After Add to my library, the success message appeared but Open workflow required another scroll at 1366 × 900. [Before scroll](18-template-installed.png), [after scroll](19-installed-next-step.png). | Keep the next action visible in a sticky footer. |

## What worked

- The original natural-language request selected a relevant research workflow.
- Permission/provider blockers were surfaced before live execution in Home.
- Connecting the existing Codex CLI account succeeded through Settings.
- Explore allowed choosing Codex when installing a copy.
- A real Codex writing workflow completed its draft and review steps (12.3 seconds and 14.4 seconds as shown by the UI).
- Read final output opened a spacious, readable result with copy/download controls. [Screenshot](29-read-final-output.png). The content addressed the fictional four-day-workweek announcement task.

## Limits

The audit was redirected to the real Amazon use case before completing manual graph construction, scheduling, or a full returning-user recovery journey. No claim is made that those journeys were audited. The keyboard/native-select retries in the interaction log are automation handling and were not counted as product defects. No purchases, messages, or published content resulted from this pass.

Raw actions and timestamps: [interaction-log.jsonl](interaction-log.jsonl).
