# Jeeves marketing materials

Use the [current launch kit](launch/README.md) for publication. It contains the latest copy, gallery, demo, and captions. Download the assembled kit from https://getjeeves.app/media/jeeves-launch-kit.zip. Run `npm run check:launch` before using it.

The current launch website is in [`../site/`](../site/README.md), with a real narrated demo and Product Hunt assets in [`video/`](video/README.md). The material below describes the earlier offline kit.

Open **index.html** for the visual overview. This folder is a self-contained, offline product-preview kit. This archive was prepared before the public preview. Use the current website and launch drafts for publication.

## Contents

| File                              | Use                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| `landing.html`                    | Responsive product-preview landing page, with interactive triage illustration               |
| `deck.html`                       | Eight-slide product presentation; use arrow keys or visible controls                        |
| `one-pager.html`                  | Editable one-page brief                                                                     |
| `exports/jeeves-product-deck.pdf` | Eight-page presentation PDF                                                                 |
| `exports/jeeves-one-pager.pdf`    | A4 brief                                                                                    |
| `exports/*.png`                   | Five marketing graphics plus deck contact sheet                                             |
| `exports/jeeves-launch-kit.zip`   | Complete portable kit; extract before opening index.html                                    |
| `copy/launch-copy.md`             | Positioning, social posts/thread, longer launch post, listing, article, and outreach drafts |
| `copy/demo-script.md`             | 90-second script, shot list, and five-minute live-demo plan                                 |
| `copy/facts-and-claims.md`        | Product evidence and current claim boundaries                                               |
| `brand/guide.md`                  | Voice, palette, typography, icon, and screenshot guidance                                   |
| `assets/`                         | Product icon, fresh product screenshots, locally bundled fonts and licenses                 |

## Audience and status

Primary audience: developers and AI power users. Campaign line: **Turn repeat work into a workflow.** The page, deck, and graphics use product-preview language because public distribution has not been announced and the source repository is private. The deck is a product introduction, not an investor deck: there are no invented market figures, traction metrics, testimonials, or financial projections.

The actual product screenshots were captured in a separate temporary Demo workspace, with synthetic examples and no provider credentials. The landing page's interactive routing diagram is an illustration of documented live test cases; it does not call a model. Current verified desktop platform: macOS Apple Silicon.

## Edit and regenerate

From the repository root, with project dependencies installed:

```sh
node marketing/tools/build.mjs
node marketing/tools/render.mjs
```

Edit the content and layouts in `tools/build.mjs` and `brand.css`; edit long-form copy directly in `copy/`. The renderer requires Google Chrome available to Playwright (`npx playwright install chrome` if needed). It produces the PDFs, PNGs, contact sheet, validation report, and ZIP locally. No provider credentials, image-generation service, or network calls are required.

Preview pages can be opened directly from disk. For a local web preview, run `python3 -m http.server 4330 --directory marketing` and open `http://127.0.0.1:4330`.

## Distribution

Send individual exports or the ZIP when ready. The kit has no analytics, signup form, live waitlist, publishing integration, or public download link. Website calls to action open the included tour and product brief. A future public release will need its actual URL and availability wording supplied before using a public-launch announcement.

The existing icon and code-generated artwork are part of the Jeeves project. Font license notices are included. Bundled third-party agent skills are not embedded in this marketing kit.
