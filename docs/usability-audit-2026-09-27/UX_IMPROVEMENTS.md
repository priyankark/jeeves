# Workspace usability improvements

Implemented after the exploratory audit and the Amazon CUA sign-in attempt.

- The right panel expands to the full application window. Inspector, Copilot and Run remain available. Restore and Escape return to the same editor without losing edits. Keyboard focus is trapped in the expanded view and restored on exit.
- The navigation rail and workspace sidebar can be hidden independently. Their preferences survive reload. Focus canvas temporarily hides all three panels and restores the previous layout. Activity and preferences remain accessible. The graph fits the available canvas when panels change, without a delayed animation during connection dragging.
- Activity tracks sign-in handoffs outside the inspector and across page navigation. Waiting handoffs remain prominent until completed or cancelled; Review sign-in opens the relevant workflow and step. Bring browser forward retrieves the waiting Chrome window.
- Optional sound plays a short two-note chime once per new event. Optional desktop alerts use Electron's isolated preload bridge, with a browser Notification fallback. Settings are opt-in; task contents are omitted from desktop alerts. Native delivery remains subject to operating-system notification settings.
- Observed run completion, failure and review requests also appear in Activity.
- Run input and input-node inspection use labeled fields, including multiline lists for groceries. JSON remains an advanced option.
- Browser failures show actionable summaries with expandable technical details. Blocked optional advertising frames no longer terminate the main website task. Denied scripts/styles produce an actionable permission error before the agent acts; requests to unapproved origins remain blocked.

## Evidence

Manual interaction used visible Chrome, screenshot inspection, mouse coordinates, keys and scrolling. A local password-form fixture exercised a real browser handoff without an account or credentials. The fixture was seeded through the local API; subsequent sign-in and recovery interactions used the UI.

- [Expanded browser inspector](ux-fullscreen-browser-inspector.png)
- [Alert while working on Home](ux-login-alert-on-home.png)
- [Activity with direct recovery action](ux-activity-handoff.png)
- [Return to the waiting browser step](ux-return-to-login.png)
- [Electron Activity smoke check](ux-desktop-activity.png)

Validation: production TypeScript/Vite/runtime build passed; 103 unit/integration tests passed. The full 40-test browser run passed 39 checks and caught an auto-fit/connection-drag race. After fixing that race, all 9 graph/layout/attention checks passed; the final attention changes passed all 5 dedicated usability checks. The other 31 browser checks passed in the full run. Electron verified the preload functions, accepted a native notification, and opened Activity from the notification-click event. Actual OS banner rendering and delivery under Focus/Do Not Disturb were not asserted.

## Build and remaining work

New desktop build: `release/ux-preview/Jeeves-darwin-arm64/Jeeves.app`.

The existing desktop app was left running because its Amazon sign-in session is waiting. Opening the new build after quitting the old app uses the same saved workspace; an unfinished interactive sign-in will need to be started again. No Amazon items were added and no purchase was placed.

This implements the requested panel and attention changes plus related grocery-input and error-recovery fixes. It does not claim to resolve every finding in NOTES.md: conversational refinement/result association, starter naming, demo result quality and provider adaptation remain separate follow-ups.
