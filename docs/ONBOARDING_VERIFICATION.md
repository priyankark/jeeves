# Onboarding and public release preparation

Tested September 28, 2026, on macOS ARM64 with preview.10.

## User simulations

| Situation | Observed result |
| --- | --- |
| New user without keys, 960 × 700 laptop | Sample is visible without scrolling, runs in Demo mode, and labels its result as a sample with no AI call |
| User skips setup | Home opens, reload keeps the choice, and Set up AI reopens setup |
| Jev key is rejected | Form remains available, error is readable, and the badge is not green |
| User corrects Jev and connects OpenAI | Both checks show Verified; entered keys are absent from browser local and session storage |
| Service fails after a successful check | Verified is replaced by Check failed |
| User connects only Codex | The builder selects Codex instead of retaining an unavailable OpenAI provider |
| Existing connected user | Workspace opens directly without another first-run prompt |
| Keyboard user at 390 px | Setup can be completed by keyboard; the next heading receives focus and the page does not overflow horizontally |

The connection success and failure scenarios above use controlled API responses. Existing integration tests also connect and run against a local model fixture. These checks establish UI behavior, not acceptance of arbitrary provider credentials.

## Installed app and live connections

The packaged Mac app starts in an isolated workspace, shows onboarding, runs the sample without keys, and matches the engine version. The package includes Apache 2.0, the project notice, and dependency notices for the UI, server, and runner.

The user's installed preview.10 was opened separately. Jev and Codex were verified through the onboarding UI with the existing saved connections. A separate API check returned success for TypeSafe in 93 ms and Codex in 196 ms. These checks do not generate model output. Two existing shopping runs remained waiting across the app restart; no answers or shopping actions were submitted.

## Validation

- Production build passed.
- 132 engine and integration tests passed.
- 56 browser tests passed. The six onboarding tests were rerun after focus handling changed and passed.
- Seven marketplace packages passed schema and checksum validation.
- Packaged Mac smoke test passed, including startup, onboarding, and the complete sample.
- Landing page passed checks at 320, 390, 768, 1280, and 1440 px. All local links and media loaded; the 64.8-second video decoded at 1920 × 1080 with captions.
- Gitleaks 8.30.1 found no secrets across all 15 existing commits. This is a pattern scan, not a guarantee that every committed artifact is suitable for public release.

## Launch materials

The public landing page explains setup and planned public source access. Product Hunt copy, screenshots, a video, and an r/SideProject post are prepared. The source repository and installers still require repository access. No launch posts have been submitted. See [remaining launch steps](PUBLIC_LAUNCH.md).
