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

Product Hunt and Reddit copy is prepared but has not been submitted. Publishing requires a signed-in maker account. Clipchamp narration replacement is also waiting for sign-in; the live video still uses the original macOS Daniel voice.
