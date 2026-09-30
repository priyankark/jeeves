# Public launch readiness

Status: public desktop preview. Source, installers, the landing page, and the YouTube demo are public. Product Hunt is submitted and scheduled for September 30, 2026 at 12:01 a.m. Pacific. The Reddit announcement is public from u/yotta_mind.

## Ready to review

- Landing page: https://getjeeves.app/
- Real product demo: https://getjeeves.app/media/jeeves-demo.mp4
- Published YouTube demo: https://www.youtube.com/watch?v=KV6YvV7WovE, with English captions and a custom thumbnail. Anonymous playback metadata verified on September 29, 2026.
- Downloadable [launch kit](https://getjeeves.app/media/jeeves-launch-kit.zip) with verified media, copy, and file hashes.
- Product Hunt copy and media map: [listing copy](../marketing/copy/product-hunt.md).
- Submitted [Product Hunt listing](https://www.producthunt.com/products/jeeves-3?launch=jeeves-6), with **Scheduled** confirmed in its pre-launch dashboard. It is not yet on the daily leaderboard.
- [Reddit announcement](https://www.reddit.com/r/SideProject/comments/1wtfvya/i_built_jeeves_an_open_source_workflow_app_with/) from u/yotta_mind, with the author and full post verified while signed out. The earlier post from a different account was deleted.
- [Technical r/LLMDevs introduction](https://www.reddit.com/r/LLMDevs/comments/1wtgo9d/i_built_jeeves_an_open_source_workflow_app_with/) from u/yotta_mind, with Tools flair, source references, creator and AI-writing disclosure. Author and full post verified while signed out.
- Apache 2.0 [license](../LICENSE), [notice](../NOTICE), and [contribution guide](../CONTRIBUTING.md).
- First-run welcome with a sample without keys, optional connection setup, verification, skip, and return.

## What is ready

Preview.11 passed 136 engine/integration tests, 56 browser tests, and packaged-app checks on Apple Silicon Mac, Intel Mac, Windows, and Linux. Both Mac apps and disk images passed Apple notarization. The release workflow verifies all five installer hashes before publication.

Evidence: [preview.11 release workflow](https://github.com/priyankark/jeeves/actions/runs/36588590424) and [source checks](https://github.com/priyankark/jeeves/actions/runs/36588539847). The source and nested launch archive passed a fresh Gitleaks scan; the production dependency audit reported no known vulnerabilities on September 29, 2026. GitHub secret scanning, push protection, vulnerability alerts, security updates, and private vulnerability reporting are enabled.

The quick start was exercised in a clean source checkout: `npm ci`, `npm run dev`, onboarding, and the sample result without keys. The source tree, including nested archives, passed a Gitleaks scan. The landing page passed keyboard, link, video, and layout checks from 320 to 1440 px.

A September 29 follow-up exercised a fresh packaged app, confirmed input waits across a reload, fixed an isolated-test setup dependency, and passed 47 focused engine/browser checks. The page now explains the name and offers direct platform downloads. The revised 64-second Clipchamp demo still needs subjective listening feedback. Details: [follow-up verification](PUBLIC_PREVIEW_VERIFICATION.md#september-29-follow-up).

## Downloaded installer check

On September 29, the Apple Silicon preview.11 DMG was downloaded from the public GitHub URL without authentication. Its SHA-256 matched the published checksum. The disk image and contained app passed signature and stapled-ticket validation; Gatekeeper reported `accepted` with `source=Notarized Developer ID`.

The downloaded app was copied into a clean test location and launched with a fresh workspace. The welcome screen, bundled license notices, isolated local engine, matching app/engine versions, disabled renderer Node access, and complete no-key weekly-update example all passed. This is an automated packaged-app check, not an external user study. Native installation on customer Windows and Linux machines has not been observed; those platforms passed their CI packaged-app checks.

## Launch status and next steps

1. Recheck signed-out access to source, license, installers, checksums, and the catalog on launch day. Keep preview and signing limitations visible.
2. Product Hunt is scheduled from Priyankar Kumar's maker account, with the source link, Free pricing, Productivity/Open Source/Artificial Intelligence tags, thumbnail, five matching gallery slides, and maker comment. The maker opted into Hypership Day and moved this existing launch to September 30. Only featured launches qualify; featured status is not yet confirmed. Edit the existing launch instead of submitting another one.
3. The landing page and Product Hunt gallery use one weekly-update story. Actual app screenshots are labeled as the built-in sample. Jev and provider details are in a separate technical section. The request-routing video remains public on YouTube and is linked from that section and the maker comment, rather than leading the gallery.
4. The r/SideProject announcement is published from u/yotta_mind and verified while signed out. Update the existing post if corrections are needed. Do not post AI-authored copy to r/opensource, whose rules prohibit it.

## Readiness judgment

Ready for a public preview and early-user feedback. Known friction remains: an unsigned Windows installer, manual updates, provider access, and retailer pages that can change. Describe those plainly. Do not present the app as a finished autonomous shopping service or claim validation by users we have not studied.

Lead with recurring tasks and a concrete example, such as turning project notes into a weekly update. Explain that users save the steps and run them again with new input. Jev is one supported decision feature, not the main pitch. Keep the category clear: Jeeves is an app for productivity workflows. The maker prefers friendly, direct copy with a small Wodehouse nod, not extended butler jokes. Wodehouse supplies the inspiration, not an endorsement. Avoid em dashes, invented claims, and requests for votes.

## Scope of the open source release

Apache 2.0 covers the Jeeves app and first-party starter workflows from this release. Earlier releases retain their existing license grants. Dependencies and imported skills keep their own terms. Hosted AI services, model weights, credentials, and usage credits are not included. A local model can handle agent steps without a hosted provider; live Jev decisions still require TypeSafe access.

## Remaining preview limits

Mac downloads are signed with Developer ID and notarized by Apple. The Windows installer remains unsigned and may show a security warning. Updates are manual. Real retailer pages can change, and browser tasks may need human login or review. Automated checks do not establish reliability on every website or answer quality for every provider.
