# Jeeves launch website

Static, responsive website at https://jeeves-workflows.vercel.app/. Vercel project: `jeeves-workflows` in `priyankarks-projects`. The Git integration uses the `site` root directory. No build framework, runtime secrets, cookies, analytics, or account form is needed.

The page explains Jev and Jeeves separately, demonstrates the three routing outcomes in an explicitly labeled illustration, embeds the real recorded product demo, and includes a downloadable workflow package. Source and preview installers are public. The page links to GitHub releases and the quick start.

Preview: `python3 -m http.server 4341 --directory site` from the repository root. Test: `node marketing/video/check-site.mjs`. Set `SITE_URL` to test production. Tests cover five viewport widths, keyboard interaction, local links, video decoding, captions, transcript, and browser errors.

Pushes to main deploy this folder through Vercel. Keep `.env*` and `.vercel` excluded from commits and deployment uploads. The desktop runtime and user workspace are not part of the site.
