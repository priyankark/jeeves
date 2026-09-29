# Public preview verification

Checked September 28, 2026, for preview.10 and the public launch copy in commit `b9fffe3`.

- GitHub recognizes Apache 2.0 and the repository is public.
- Signed-out requests return successfully for the repository, license, quick start, release page, and raw workflow catalog.
- A signed-out browser renders the new README and updated Vercel page.
- The public Mac Apple Silicon DMG downloads without credentials and matches `SHA256SUMS.txt`.
- The downloaded app was launched from its mounted image with an isolated workspace. Onboarding and the complete sample passed without provider credentials. This does not test Gatekeeper's first-download warning; preview signing limitations remain.
- The app reads all seven packages from the public GitHub catalog.
- A clean source checkout passed `npm ci`, `npm run dev`, onboarding, and the sample without keys.
- The source tree, including nested archives, passed Gitleaks 8.30.1. This is a pattern scan, not a guarantee about every artifact.
- The deployed landing page passed layout checks at 320, 390, 768, 1280, and 1440 px, keyboard interaction, local links, video decoding, captions, transcript, and browser-error checks.
- GitHub checks for commit `b9fffe3` passed. Private vulnerability reporting is enabled.

The initial local download and screenshot check ran out of disk space. Removing the isolated temporary checkout allowed both checks to pass on retry. No user workspace or recorded demo source was removed.

Product Hunt and Reddit copy is prepared but has not been submitted. Publishing requires a signed-in maker account. The demo narration was initially regenerated in Clipchamp using Ryan (English UK). A later revision is documented below.

## September 29 follow-up

The landing page now introduces Jeeves as an app for productivity workflows. A “Why Jeeves?” section explains the Wodehouse character and the Jev connection, with a linked literary source. Direct downloads distinguish Apple silicon, Intel Mac, Windows x64, and both Linux formats. The unsigned-preview notice is beside the installers.

A fresh packaged Mac app was exercised through visible browser controls in a separate user-data directory and workspace. These are agent simulations, not external-user studies:

- Newcomer: chose **Try the example**, ran the sample without credentials, and read the clearly labeled simulated weekly update.
- Reviewer: opened the run, expanded its panel to full screen, opened formatted final output, restored the panel, and dismissed both left navigation panels. Controls to restore them remained available.
- Shopper: started the grocery workflow in demo mode, left the input form unanswered, and reloaded the app. It remained paused. Submitting the requested information completed the simulation without opening a retailer. Existing personal runs were untouched.

The focused persona command initially exposed test-order dependence: several workspace tests assumed another test had already created a chat and suppressed onboarding. Their setup now explicitly marks onboarding complete. The dedicated onboarding tests still exercise the welcome screen. The independent rerun passed 28 engine checks and 10 browser journeys; 9 additional onboarding/first-workflow browser tests also passed.

Signed-out HEAD requests succeeded for all five release installers. Local landing-page checks covered 320, 390, 768, 1280, and 1440 px, the three interactive examples, keyboard operation, links, and media. An additional 200% CSS zoom check showed no horizontal overflow. The name section and mobile layout were visually inspected.

The revised demo uses Clipchamp’s Andrew Multilingual voice, English US, at default pitch and 1x pace. It is approximately 64 seconds and ends with an invitation to try the example. All eight audio clips were checked against the script using local Whisper recognition, then used for aligned captions. This establishes wording and approximate timing, not subjective naturalness. A human listening review remains outstanding.

These checks do not establish native Windows/Linux installation, Gatekeeper behavior, live retailer reliability, or satisfaction among real new users. The readiness verdict remains an honest public preview, with unsigned installers, manual updates, and provider setup as known friction.

Production checks on getjeeves.app also passed. The deployed video matched the local SHA-256 hash. Both www.getjeeves.app and the old jeeves-workflows.vercel.app address redirect to the apex domain with paths and query strings preserved. The old address required an explicit project-domain redirect after a Git deployment. Film and caption URLs now carry content hashes to avoid serving an older cached narration to returning visitors.

The final cut is also saved as **Jeeves launch demo v2** in Clipchamp, with its media backed up to OneDrive. The generated narration clips are stored separately as **Jeeves narration source clips v2**.
