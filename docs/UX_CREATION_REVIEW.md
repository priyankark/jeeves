# Creating workflows through the desktop UI

September 27, 2026. Agent-operated exploratory testing in the actual packaged Electron window, attached through Playwright's desktop debugging connection. Workflows were created, configured, connected, and run through visible controls. Read-only API requests collected run evidence afterward. These are simulated user journeys with synthetic inputs, not a human usability study.

## Workflows saved in the user's library

| Workflow | Creation journey | Live outcome |
| --- | --- | --- |
| Meeting notes to actions | New workflow → add Codex agent → configure instructions → connect ports → edit input → run | Decisions and action items extracted; missing owners and dates remained explicitly unknown. |
| Bug report triage | New workflow → describe task to live Copilot → review and apply six-node proposal → validate → run → refine decision options in Inspector | Checkout outage reached urgent; a tooltip typo reached normal; an underspecified report reached the missing-information specialist after improving the decision design. |
| Project status from notes | New workflow → add agent → attach installed `internal-comms` skill → configure synthetic notes → validate → run | Produced a concise update separating completed work, plans, dependency, and ask, without invented dates or owners. |

All three are available under **Workflows** in the local desktop workspace. The final triage graph has six nodes and eight connections: urgent, normal, needs_information, and a separate low-confidence review route. The last two routes share a clarification specialist. Nothing was posted to external systems.

## Problems found and changes verified

1. **Adding an agent overlapped the input and left it disconnected.** The first run failed validation. A simple chain now inserts a step between connected nodes, removes the bypass, creates both connections, shifts downstream nodes, and fits the canvas. Ambiguous branches still require an explicit connection and explain that requirement. Repeated in the desktop with Project status from notes: three nodes, two connections, valid immediately.

2. **Deleting an edge also deleted the previously selected agent.** Edge selection now clears the independent node selection. Repeated the mistake in the desktop: deleting one edge left all three nodes; Undo restored the second edge.

3. **Home chat kept conflicting saved example data.** Selecting Bug report triage and requesting a minor tooltip typo retained the saved checkout-outage fields, merely appending `task`. Jev therefore chose urgent, and the specialist explicitly called out conflicting input. Live chat now prepares structured input with the configured assistant even when the workflow has already been selected. Instructions distinguish task examples from configuration and require replacing conflicting task content. Explicit JSON passes through unchanged, and a model cannot silently switch an explicitly selected workflow. The repeated desktop chat preview contained the typo report without the outage; Jev chose normal and the correct specialist completed. Local/demo preparation explicitly discloses that saved fields remain and need review.

4. **A long choice label covered its connection handle.** Trying to connect `needs_information` dragged the decision node because its label intercepted pointer events. Labels now allow pointer events through. The same desktop drag then created the eighth connection and validation passed. A browser regression reproduces this interaction.

5. **Copilot offered no cancellation during a long generation.** The six-node proposal took approximately 104 seconds. Its composer now exposes Stop while generating, explains that generation may take up to two minutes, preserves the request for editing, and ignores late responses. Disconnecting the request aborts the server-side generation. Verified in the desktop: Stop returned the request to the composer, retained the three-node graph, and the corresponding Codex child process was no longer running.

6. **Trace ordering followed node creation order.** The meeting workflow displayed output before its newly added agent. Editor and Home traces now order nodes by dependencies. The new status workflow showed input → agent → output.

## Model behavior and workflow design

The original urgent/normal decision classified an almost empty report as normal with 84% confidence, above its 70% review threshold. Its specialist correctly questioned that classification. This was a semantic failure despite successful execution.

Through the Inspector, added an explicit `needs_information` choice and connected it to the clarification specialist; raised the separate confidence threshold to 90%. The repeated report selected `needs_information` with 100% confidence and left urgency undetermined. The confidence describes certainty that information is missing, not certainty that impact is low. The urgent and normal cases were rerun after this change. Copilot's design instructions now recommend an explicit missing-information option when appropriate.

These cases demonstrate live Jev connectivity and selected-branch execution, not general accuracy or confidence calibration. The task preview remains an important review step. Natural-language input preparation depends on the configured model. Copilot generation latency remains a friction point; cancellation improves control, not speed.

## Verification and evidence

Production build passed; 94 unit/integration checks and 15 distinct relevant browser checks passed across the final affected suites. Browser checks supplement the desktop exploration. All task inputs in this session were synthetic; no real grocery checkout or retailer authentication was tested here.

- [Saved live run evidence, including the two incorrect pre-fix outcomes](ux-creation-live-evidence.json)
- [Saved workflow library](ux-created-workflows-library.png)
- [Disconnected first agent](ux-create-disconnected-error.png)
- [Connected agent with skill after the fix](ux-create-agent-after.png)
- [Meeting result](ux-created-meeting-result.png)
- [Corrected chat input](ux-chat-corrected-input.png)
- [Correct normal-priority chat result](ux-chat-normal-result.png)
- [Skill-powered project status](ux-created-status-result.png)
- [Missing-information result after refining the workflow](ux-triage-needs-information-result.png)
- [Stopped Copilot request](ux-copilot-stopped.png)

The source changes were built into the packaged desktop. The three workflows persist in the user's local workspace; the original checkout example was restored in Bug report triage after testing.
