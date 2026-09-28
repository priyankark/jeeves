# Public launch readiness

Status: preparing a public desktop preview. No Product Hunt or Reddit post has been submitted.

## Ready to review

- Landing page: https://jeeves-workflows.vercel.app/
- Real product demo: https://jeeves-workflows.vercel.app/media/jeeves-demo.mp4
- Product Hunt copy and media map: [listing draft](../marketing/copy/product-hunt.md).
- Reddit post: [r/SideProject draft](../marketing/copy/reddit-sideproject.md).
- Apache 2.0 [license](../LICENSE), [notice](../NOTICE), and [contribution guide](../CONTRIBUTING.md).
- First-run welcome with a sample without keys, optional connection setup, verification, skip, and return.

## Required before posting

1. Review the latest check and desktop installer runs. Publish the tested release and make the repository public when the owner is ready. Existing private repository links are not a public download path.
2. In a signed-out browser, open the repository, source license, installer downloads, checksums, and catalog. Download the correct installer onto a clean machine and complete the sample and connection setup.
3. Replace collaborator-only wording on the landing page, README, and release notes after access is public. Keep preview and signing limitations accurate.
4. Use the maker's Product Hunt and Reddit accounts. Recheck community rules and required listing fields on the submission day. The current drafts make no user-count or success-rate claims.
5. Upload the finished video to the maker's YouTube account for Product Hunt. Product Hunt requires a full YouTube URL for the video slot. The MP4 already works on the website and GitHub.

## Launch order

Publish the repository and a tested release first. Test the download and onboarding without an existing account or workspace. Then prepare the Product Hunt listing with the screenshots and demo. Share one relevant Reddit post when users can actually install the app, and collect reports in GitHub Issues.

Keep the description simple: Jeeves is a desktop app for repeat AI work. Agents do focused tasks, Jev makes decisions, and people answer questions when needed. Avoid em dashes, invented claims, and requests for votes.

## Scope of the open source release

Apache 2.0 covers the Jeeves app and first-party starter workflows from this release. Earlier releases retain their existing license grants. Dependencies and imported skills keep their own terms. Hosted AI services, model weights, credentials, and usage credits are not included. A local model can handle agent steps without a hosted provider; live Jev decisions still require TypeSafe access.

## Remaining preview limits

Installers are not signed with a trusted publisher certificate or notarized. Updates are manual. Real retailer pages can change, and browser tasks may need human login or review. Automated checks do not establish reliability on every website or answer quality for every provider.
