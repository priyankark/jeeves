# Jeeves launch kit

Jeeves is an open source app for productivity workflows.

Website: https://getjeeves.app/
Source and installers: https://github.com/priyankark/jeeves
Download this kit: https://getjeeves.app/media/jeeves-launch-kit.zip

This kit is for the public desktop preview. It contains the current copy, real product screenshots, a 64-second demo, captions, and a thumbnail. It contains no customer testimonials or user-study results.

## Product Hunt

Use `product-hunt-fields.json` for the listing fields, `product-hunt-comment.txt` for the maker comment, and the five numbered gallery images in their listed order. The 240 × 240 thumbnail is separate. Pricing is Free; connected AI services may charge for usage.

The demo video is optional. To include it in Product Hunt, upload `jeeves-demo.mp4` to the maker's YouTube account, set it to Unlisted or Public, and paste the full `https://www.youtube.com/watch?v=...` URL. Use `youtube-title.txt` and `youtube-description.txt`; upload `jeeves-demo.vtt` as English captions. Use the poster as the custom thumbnail if the account supports that feature. The software demo is not made for kids. It contains a stock synthetic narrator, not an impersonation or footage of a real person saying something they did not say; answer any disclosure questions against the current upload form.

Save a draft before setting a launch date. Verify the maker identity, gallery order, download links, pricing, and preview limitations in the actual Product Hunt preview. A local file is not an online draft, and this kit does not mean a post has been submitted.

## Reddit

`reddit-title.txt` and `reddit-post.txt` are prepared for r/SideProject. Recheck the sidebar, pinned posts, and submission form immediately before posting. Post once, disclose that you built it, and answer questions. Do not request votes or send unsolicited promotion. Do not use this AI-assisted draft in communities that prohibit it.

## Downloads and support

The preview supports Mac Apple silicon, Intel Mac, Windows x64, and Linux x64. Mac downloads are signed and notarized by Apple. The Windows installer is unsigned and may show a security warning. Updates are manual. The built-in example uses sample data and makes no AI calls. Live runs need the relevant provider connections. Browser tasks require Chrome and may need manual login or review.

Setup: https://github.com/priyankark/jeeves/blob/main/docs/QUICKSTART.md
First-run feedback: https://github.com/priyankark/jeeves/issues/new?template=first_run.yml
Bug reports: https://github.com/priyankark/jeeves/issues/new?template=bug_report.yml
Security reports: https://github.com/priyankark/jeeves/security/advisories/new

## Launch-day sequence

1. Run the live launch checks and confirm the current GitHub checks are green.
2. Try the download and built-in example once on the machine you will use for support.
3. Check the actual Product Hunt preview and, if included, play the YouTube video while signed out.
4. Publish when the maker can be available to answer questions. Use the platform's scheduling controls and displayed timezone.
5. Share the r/SideProject post once, following its current rules.
6. Collect installation, setup, and first-workflow reports. Reproduce failures before promising a fix. Record actual outcomes separately from agent simulations.

If the download is broken or the app cannot start, hold the announcement. Correct the release or link to a known working preview. Do not overwrite an already published installer; publish a new version.

## Asset verification

`manifest.json` lists the byte size and SHA-256 hash of each included file. `product-hunt-fields.json` includes source links for the platform limits. The build command is `npm run launch:kit`; validate with `npm run check:launch`. Use `npm run check:launch -- --live` to check the public site, repository, installers, checksums, and domain redirects.

For a complete download audit, run `npm run check:launch -- --live --download-installers`. This also streams all five public installers and compares their actual SHA-256 hashes with the release checksums.
