# Jeeves launch website

Static, responsive website at https://getjeeves.app/. Vercel project: `jeeves-workflows` in `priyankarks-projects`. The Git integration uses the `site` root directory. No build framework, runtime secrets, cookies, analytics, or account form is needed.

The page introduces reusable AI workflows through one weekly-update example. Visitors can inspect the real input, canvas, and sample result. A separate Under the hood section explains providers, optional Jev decisions, saved progress, and a technical video. Source and preview installers are public.

Preview: `python3 -m http.server 4341 --directory site` from the repository root. Test: `node marketing/video/check-site.mjs`. Set `SITE_URL` to test production. Tests cover five viewport widths, keyboard interaction, local links, video decoding, captions, transcript, and browser errors.

Pushes to main deploy this folder through Vercel. Keep `.env*` and `.vercel` excluded from commits and deployment uploads. The desktop runtime and user workspace are not part of the site.

The primary domain is `getjeeves.app`; `www.getjeeves.app` and the previous `jeeves-workflows.vercel.app` address redirect to it, preserving paths and query strings. The domain is registered in `priyankark-s-team`, while the website project remains in `priyankarks-projects`. DNS verification records in the domain team authorize the project to serve both hostnames. Keep those records in place.
