# First useful result and product positioning

Implemented September 27, 2026.

Jeeves now leads with **Turn repeat work into a workflow**. The first example is one concrete task: turn project notes into a weekly update through drafting and checking. Editing, decisions, scheduling, and portability support that promise rather than competing as separate introductions.

## The first-use path

1. Home shows the expected output and **Try the example** before the open-ended composer.
2. Review the included project notes and select **Run demo**. No provider setup or model call is required. The run action stays visible while scrolling the input.
3. Read or download a usable sample update. The sample disclosure is part of the output and survives copying/download.
4. Select **Use my own notes**. Sample fields clear, Live is selected, and the earlier demo remains explicitly identified as a previous run.
5. Add notes, connect one AI service in a focused dialog, and apply it to the writing/analysis steps. Notes remain intact while the connection is configured. Browser and decision settings are not silently remapped.
6. Run, review the result, and reuse the process with new input. Open the editor to customize and save the workflow; conversations and completed runs retain their snapshots.

The curated sample only applies to the exact example notes and original graph instructions. Edited notes, changed prompts, and changed graph structure fall back to clearly disclosed simulation details. Live always calls the configured model. General demo diagnostics are expandable rather than presented as the useful answer.

## Verification

- Full production build passed.
- Full unit/integration suite: **114 passed**.
- Full browser suite: **48 passed**.
- Final focused checks after refinements: **9 unit tests and 8 browser tests passed**.
- Catalog validation: **7 packages passed**.
- Marketing renderer regenerated and checked the deck, one-pager, graphics, local links, mobile layout, and launch-kit archive.

The new browser tests cover a new laptop user, sample download, changed-note simulation behavior, setup cancellation without losing input, and connecting a local model endpoint through the actual settings UI. The live-path test uses a local HTTP fixture, checks that both agent requests receive the edited input, and verifies the completed run. It tests integration behavior, not model quality.

Screenshot-guided mouse/keyboard inspection used a visible Chrome window against an isolated workspace, at 1366×900 and 960×700. It covered the initial explanation, sample review/run/result, transition to blank own-note fields, and reaching connection setup. This found the off-screen run action, a misleading OpenAI-specific missing-connection message, and New chat retaining an old scroll position; all three were corrected. New chat now returns to the introduction and focuses Try the example. Evidence: [Home](first-run/home.png), [laptop Home](first-run/laptop-home.png), [final review](first-run/review.png).

## Next evidence needed

Independent users still need to demonstrate installation and first-task completion without coaching. The curated example and HTTP fixture do not establish live output quality across providers. Distribution/signing and the actual Amazon shopping journey remain separate work. The installed desktop bundle was not replaced during this pass.
