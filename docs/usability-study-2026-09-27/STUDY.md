# Jeeves usability study — 27 September 2026

This is an agent-led usability inspection with simulated user roles, not a study with recruited participants. Visible Chrome is operated through screenshot-guided coordinate clicks and keyboard input. API calls may seed fixtures and verify state; they do not count as user interactions. Screenshots and the interaction log record the manual sessions. No purchases or external messages are authorized.

## Protocol

Use a fresh isolated workspace at localhost:4335. Preserve the existing Amazon login and preview workspace. First observe a journey, record friction and its consequence, then change the product and repeat affected journeys. Separate actual observations, code-based findings, automated regression coverage, and untested hypotheses. Do not infer population-level success rates or satisfaction.

| Journey | Simulated role and goal | Success criterion |
|---|---|---|
| 1 | First-time user: prepare and run a writing task | Understand demo, edit the task, find its result |
| 2 | Returning writer: refine a completed task | Original request retained; previous result is not mistaken for new output |
| 3 | Writer: start a different task | Explicit way to replace rather than append instructions |
| 4 | Shopper: answer an input request | Field validation, draft recovery, same-run continuation |
| 5 | Interrupted shopper: leave and return | Waiting request discoverable; unrelated work remains accessible |
| 6 | Author: create and inspect a workflow | Discover input step, expand inspector, recover dismissed panels |
| 7 | Laptop/keyboard user | Primary actions reachable at 960×700; focus and Escape work |
| 8 | Library user: install a starter twice | Distinguishable saved copies or open existing option |
| 9 | Scheduler | Create, review timezone, pause and remove schedule |
| 10 | Failed-run recovery | Clear error and next action; completed work preserved |
| 11 | Browser handoff | Find login request and return to the relevant workflow |
| 12 | Release readiness | Build, runtime, unit/integration and browser suites pass |

## Observations and results

Executed journeys and evidence are recorded below.

## What this round established

The most consequential problems were loss of task context, misleading run state, and controls moving during interaction. These are functional usability defects, rather than visual preferences. Changes now preserve a refined request, distinguish earlier output, show the new proposal for review, fit the measured canvas before enabling interaction, and keep waiting work recoverable without blocking navigation.

This round used a fresh workspace, visible Chrome at 1366×900 and 960×700, synthetic writing and shopping requests, and a local HTTP/password-page fixture. There were no purchases, real credential entries, external messages, or recruited participants. The existing Amazon session and the installed desktop workspace were not replaced. The observations below are individual simulated journeys, not population-level task-success statistics.

## Journey evidence

| Journey | Actions actually performed | Result and evidence |
|---|---|---|
| First-time writer | Entered a volunteer cleanup request, reviewed input, ran Demo, found output | Completed. Demo explicitly says no model was called; output is a simulation rather than an actual email. [Initial plan](02-writing-plan.png), [output](06-scrolled.png). |
| Refining a completed task | Asked for a shorter version and cheerful subject line | Before: task was replaced and earlier output appeared current. After: original request plus update retained; earlier output has a distinct heading and explanation. [Before](07-refinement-loss.png), [after](64-refinement-fixed.png), [persisted state](refinement-state.json). |
| Different task in the same conversation | Selected “Start a different task,” requested a hiking birthday card | New proposed input contains only the birthday request. Prior run remains explicitly identified as earlier. [New input](66-new-task-input.png), [persisted state](new-task-state.json). |
| Returning writer after interruption | Reopened a saved conversation using Recent conversations in a fresh browser context | Completed run and request recovered from the server. [Restored conversation](62-chat-restored.png). Unsubmitted chat drafts were not tested for persistence. |
| Shopper: invalid answers | Ran a fixture with grocery questions, supplied a zero budget and invalid ZIP, submitted | Correct fields flagged, first invalid field focused, run remained waiting. Corrected budget to 25 and ZIP to 02139. [Validation](19-invalid-shopping.png). |
| Interrupted shopper | Left the waiting run, opened an unrelated workflow, reloaded Home, opened Activity, returned to questions | Navigation remained available, list/budget/ZIP/allergy draft persisted. Selected No substitutions and submitted; the same run completed and retained its completed input step. [Other workflow](21-unrelated-workflow.png), [Activity](22-return-activity.png), [restored draft](23-draft-restored.png), [completion](24-shopping-complete.png). Run ID: `5f8b23f5-c32a-4b23-bb7d-c745fc7580a9`. |
| Workflow author | Created and named a blank workflow, added Ask for input, chose the grocery preset, renamed the step in fullscreen, escaped, validated, entered and exited Focus canvas | Three nodes and two connections, five questions, valid graph. Fullscreen retained edits and Focus restored the panels. [Add node](47-add-input-step.png), [fullscreen](48-author-fullscreen.png), [focused canvas](49-authored-focus-canvas.png). |
| Laptop user | Resized to 960×700, dismissed navigation, opened a marketplace preview, used Shift+Tab to reach the original hidden action | Original preview buried the primary action; fixed preview keeps install/open visible independently of body scrolling. [Before](09-preview-laptop.png), [after](12-fixed-preview-action.png). Resize also exposed an overlaying sidebar, now collapsed on entering a narrow layout. |
| Library user | Installed another Draft & review, returned to the library, searched for a fixture workflow | Copy is visibly distinguished as “Draft & review · copy 2.” Search returned the intended workflow. Concurrent duplicate imports and 100-character names also have automated coverage. [Install](13-installed-copy.png), [library](14-library.png), [search](15-find-grocery.png). |
| Service recovery | Ran a live read-only local request, encountered denied website access, allowed that origin, resumed, encountered deliberate HTTP 503, resumed again | Completed after the second retry; initial input step reused from checkpoint. Found and fixed obsolete urgent alerts from the previous failed run. [Permission](27-recovery-permission.png), [503](28-service-unavailable.png), [completion](29-recovery-completed.png). Alert cleanup verified by the browser regression suite. |
| Browser handoff | Started CUA sign-in on a local synthetic password page, waited for handoff, left the editor, used Activity to return, cancelled the fixture session | Correct waiting handoff and global prompt; cancellation restored controls. No password entered and no claim of successful authentication. [Handoff](34-login-waiting.png), [away from editor](35-login-away.png), [return](36-return-signin.png), [cancel](38-login-cancelled-navigation.png). Sound/native notification behavior has automated coverage; this round does not claim a human assessment of sound quality. |
| Scheduler | Created a weekday Demo schedule, changed timezone to America/New_York, previewed five occurrences, created, paused, and deleted it | Correct visible timezone and next occurrence; paused state had no upcoming run; deletion removed the fixture schedule. [Preview](53-schedule-preview.png), [created](57-scheduled.png), [paused](58-paused-delete.png), [confirmation](59-delete-confirm.png). Schedule editing and due-time execution were automated, not manually repeated here. |

## Defects fixed

Severity is an inspection judgment based on consequence, not measured prevalence.

| Priority | Finding | Change | Verification |
|---|---|---|---|
| High | Local follow-ups discarded the original task | Explicit refine/new intent. Refinement preserves current edited fields and appends the update; a new task resets task content | Manual before/after; chat unit tests and browser study test |
| High | Old output could look like the result of a new proposal | Previous-run heading, explicit not-yet-run explanation, expandable actual run input | Manual before/after; browser test |
| Medium | Follow-up scrolling skipped the new review form | Scroll to the proposal after preparation | [Final manual screenshot](69-final-review.png) and viewport assertions for the proposal and workspace controls |
| High | Initial canvas fits moved a branch handle between hover and press | One fit after graph measurement, interaction hidden until ready; removed delayed insertion animation | GitHub trace inspection, repeated drag tests, laptop graph inspection |
| High | Selecting a new template left the previous graph briefly clickable | Hide old canvas and disable editing during workflow switching | Previously failing undo/delete scenario passes in final full browser suite |
| Medium | A waiting request disabled opening unrelated workflows | Separate navigation availability from run-edit protection | Manual interruption journey; browser regression |
| Medium | Preview installation/open controls disappeared below long content | Fixed action footer; scroll preview content independently; show install errors inside modal | Manual 960×700 before/after; viewport tests |
| Medium | Repeated imports had indistinguishable names | Serialized import naming with numbered copies and schema-length protection | Manual library check; concurrent import and long-name tests |
| Medium | Narrowing the window left a sidebar covering content | Collapse sidebar when entering narrow layout and on narrow-screen navigation | Observed before; responsive behavior included in implementation and subsequent narrow journeys |
| Medium | Successful retry left an urgent alert for the failed predecessor | Mark the predecessor's notice handled when its continuation is published; preserve unrelated notices | Manual discovery; website-access browser regression |
| High | Disk-full browser errors instructed the user to install Chrome | Specific actionable disk-space error; technical failures remain inspectable | Reproduced ENOSPC failure, error-path implementation, build and integration validation |
| Medium | Portable export tests accumulated temporary bundles | Remove generated exports after each test; remove only old test-export directories during investigation | Code inspection and subsequent successful test runs |
| High | Sign-in assistance could inspect before a slow navigation completed | Wait for click-triggered navigation instead of explicitly skipping that wait | Existing login isolation test now includes a 650 ms delayed authentication response |
| Low | Missing yes/no answer said “Please enter allow suitable substitutions” | Choice-specific “Please choose an answer” feedback | Manual discovery; input validation regression suite |

## Build and test investigation

The latest pushed GitHub check failed in `tests/browser/creation.spec.ts`, expecting four edges after a drag but seeing three. The trace showed the viewport scale changing from 1.6 to about 0.931 between hover and press. This was a canvas initialization race; both local and GitHub production builds had passed. GitHub run: https://github.com/priyankark/jeeves/actions/runs/36363996265

The first local unit run had eight failures, including explicit `ENOSPC` errors from Chrome temporary-directory creation. Removing old generated test export directories made the unchanged baseline pass all 107 tests. Later overlapping browser-heavy checks also exposed timeouts and the navigation race described above. Unit worker count is now limited to two; the final unit and full browser verifications were run sequentially.

Final validation:

- Production build: TypeScript, Vite, and bundled runtime passed. [Build log](build.log).
- Full unit/integration suite: 109 passed. A subsequent package boundary check added one test; all nine package tests passed. Total current unique unit/integration cases covered: 110. [Full suite](unit-tests.log), [package boundary tests](package-boundary-tests.log).
- Full browser suite: 45 passed. [Browser log](browser-tests.log).
- Final Home scrolling change: targeted Home/study tests recorded separately in [Home checks](home-final-tests.log).
- Canvas suite repeated five times after the measured-fit change: 15 passed, including five repetitions of the exact branch-drag regression. Earlier intermediate implementation also passed ten repetitions but was superseded after the laptop framing inspection. [Repetition log](canvas-repetitions.log).
- Catalog validation: all seven packages passed. [Catalog log](catalog.log).
- Vite still reports a non-fatal bundle-size warning (roughly 815 kB minified JS). This is not the reported CI failure.

The validation above was performed locally before publication. GitHub checks run separately after the commit is pushed. The installed desktop application was not replaced during this study.

## Remaining friction and research priorities

1. **Scheduling remains too technical for casual users.** Cron syntax and a raw JSON input editor are present even in a straightforward weekday task. The task can be completed, but a structured input editor and progressive disclosure of cron details would reduce the knowledge required. An unsaved schedule was also lost when an attempted keyboard action closed the dialog; persistent drafts would make recovery safer. Evidence: screenshots 52–56. No claim about how often real users would hit this.
2. **Demo output teaches implementation more than usefulness.** The writing journey returns instructions, context source, and a simulated-response explanation rather than a useful sample email. The disclosure is honest, but first-time users may struggle to judge value. Test a clearly labeled sample result with technical details collapsed. Evidence: screenshot 06.
3. **Provider language is still prominent.** “openai,” “0 assigned skills,” “Harness / provider,” and separate model configuration appear during simple tasks. This inspection did not repeat a paid live model run or audit all provider setup paths. Test whether users can identify exactly what they need to connect and whether a template should offer one explicit provider-remapping action.
4. **Long questions and results still require scrolling.** Fullscreen makes them readable, but does not by itself prove good keyboard or screen-reader usability. Some keyboard interactions were exercised; no complete screen-reader audit or WCAG conformance claim is made.
5. **The test harness had two closed-tab interruptions.** The study resumed using a persistent browser profile; these events are in the interaction log. Their cause was not established, so they are not attributed to Jeeves. Unavailable screenshots 41 and 44 were not counted as evidence.
6. **Amazon's actual shopping journey remains unverified here.** Synthetic fixtures test requesting details, handoff, recovery, and cart behavior in automated tests. They cannot establish current Amazon availability, account behavior, substitutions, address handling, or checkout usability.

## Proposed real-participant follow-up

Recruit a small qualitative round spanning first-time nontechnical users, returning workflow users, and people who regularly automate tasks, including keyboard/assistive-technology users. This is a proposed study, not work already performed.

Use the same task outcomes without telling participants which controls to click. Ask them to describe what they believe will happen before running, leaving a waiting request, switching between Demo and Live, or creating a schedule. Record completion, assistance needed, wrong turns, recovery, and whether they correctly identify the input and result belonging to a run. Capture real task times only with consent and a defined start/stop rule. Ask perceived ease after each task; do not turn this inspection into a fabricated satisfaction score.

Prioritize three questions: Can a first-time user get a useful result without understanding providers? Can an interrupted user reliably resume the correct task? Can a user predict the next scheduled execution and its input? Repeat the same tasks after the next changes, counterbalance version order where practical, and review disagreements rather than treating one participant's preference as universal.

## Reproducing the study setup

Build the repository, then start it with `PORT=4335 JEEVES_DATA_DIR=/tmp/jeeves-study-20260927 npm run start`. Use an isolated workspace and keep real account workspaces separate. Run `node docs/usability-study-2026-09-27/fixture.cjs` for the local service/password page, then `node --import tsx docs/usability-study-2026-09-27/seed.mts` to seed the three synthetic workflows. No fixture credentials are needed. The first `/retry` request returns 503 and subsequent requests succeed. Restart the fixture to repeat that case.

The [interaction log](interaction-log.jsonl) records coordinate/keyboard actions and screenshot requests. Fixture setup and read-only API assertions are not counted as manual user actions. Screenshots show the progression, including intermediate implementations; the report identifies which observations were verified after the final change.

During the final preview-server restart, one screenshot (68) captured a transient fetch error. Reloading after the server restarted restored the saved conversation; screenshot 69 is the final review position. Screenshot 67 records an intermediate scroll implementation that was replaced because it moved the outer workspace. The final implementation scrolls only Home’s content container.
