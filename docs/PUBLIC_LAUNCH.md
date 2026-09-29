# Public launch readiness

Status: public desktop preview. Source, installers, and the landing page are public. No Product Hunt or Reddit post has been submitted.

## Ready to review

- Landing page: https://jeeves-workflows.vercel.app/
- Real product demo: https://jeeves-workflows.vercel.app/media/jeeves-demo.mp4
- Product Hunt copy and media map: [listing draft](../marketing/copy/product-hunt.md).
- Reddit post: [r/SideProject draft](../marketing/copy/reddit-sideproject.md).
- Apache 2.0 [license](../LICENSE), [notice](../NOTICE), and [contribution guide](../CONTRIBUTING.md).
- First-run welcome with a sample without keys, optional connection setup, verification, skip, and return.

## What is ready

Preview.10 passed 132 engine/integration tests, 56 browser tests, and packaged-app checks on Mac, Windows, and Linux. The Intel Mac disk-image tool encountered a temporary busy-volume error; its retry passed. The release contains five installers and checksums.

The quick start was exercised in a clean source checkout: `npm ci`, `npm run dev`, onboarding, and the sample result without keys. The source tree, including nested archives, passed a Gitleaks scan. The landing page passed keyboard, link, video, and layout checks from 320 to 1440 px.

## Before Product Hunt or Reddit submission

1. Recheck signed-out access to source, license, installers, checksums, and the catalog on launch day. Keep preview and signing limitations visible.
2. Use the maker's Product Hunt and Reddit accounts. Recheck community rules and required fields. Publishing access for these accounts is not connected in this workspace.
3. Upload the finished demo to the maker's YouTube account for Product Hunt. Its video slot requires a full YouTube URL. The MP4 already works on the website and GitHub.
4. Submit one relevant Reddit post, then answer questions and collect first-run reports. The current target is r/SideProject. Do not post AI-authored copy to r/opensource, whose rules prohibit it.

## Readiness judgment

Ready for a public preview and early-user feedback. A broad launch still has friction: unsigned installers, manual updates, provider access, and retailer pages that can change. Describe those plainly. Do not present the app as a finished autonomous shopping service or claim validation by users we have not studied.

Keep the copy playful and clear: Jeeves is a desktop app for repeat AI work. Agents do focused tasks, Jev makes decisions, and people answer questions when needed. Wodehouse supplies the inspiration, not an endorsement. Avoid em dashes, invented claims, and requests for votes.

## Scope of the open source release

Apache 2.0 covers the Jeeves app and first-party starter workflows from this release. Earlier releases retain their existing license grants. Dependencies and imported skills keep their own terms. Hosted AI services, model weights, credentials, and usage credits are not included. A local model can handle agent steps without a hosted provider; live Jev decisions still require TypeSafe access.

## Remaining preview limits

Installers are not signed with a trusted publisher certificate or notarized. Updates are manual. Real retailer pages can change, and browser tasks may need human login or review. Automated checks do not establish reliability on every website or answer quality for every provider.
