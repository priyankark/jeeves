# User simulation findings — 2026-09-26

This is an automated evaluation of persona journeys, not evidence from recruited human participants. It combines 12 repeatable scenario tests, 8 additional browser UX journeys, two real Codex runs over synthetic data, a public GitHub read, and a portable browser-skill execution. Existing scheduling, skill marketplace, editor, and checkpoint tests remain included.

## Findings and changes

| Persona / task | Friction or failure found | Change and verification |
| --- | --- | --- |
| First-time user | Reviewing a simple task required editing raw JSON. | Home renders named task fields with typed numbers/checkboxes; JSON remains available. A browser journey edits and completes a task without JSON. |
| Private GitHub maintainer | HTTP steps could not authenticate or use a repository supplied at run time. | Added origin-scoped named Bearer credentials, URL interpolation, and typed JSON body interpolation. Authenticated fixture requests succeed without putting tokens into workflows, run snapshots, or browser storage. |
| User setting up an integration | Website permissions required environment-file edits. | Added Settings → Websites & API access. A browser test proves a blocked run becomes ready immediately after setup while retaining edited task input. |
| Maintainer encountering an expired token | Failure only reported an HTTP status. | 401, 403, 404, and 429 errors now include a next step; 429 displays Retry-After when supplied. |
| User with duplicate imported workflows | Equal workflow names could silently select the first copy. | Tied matches ask the user to choose. Repeated words no longer inflate matching scores. |
| Grocery shopper | Agents had no browser-control tool. | Added Browser task nodes with page observations, clicks, form entry, scroll, screenshots, separate persistent Chrome profiles, provider/skill selection, and a bounded step count. Codex also sees screenshots. |
| Budget/allergy-conscious shopper | Needed evidence that constraints reached actual browser actions. | A real Codex run added oat milk and rolled oats, checked a $7 total under $15, respected the no-nut constraint, and returned review before checkout. The fixture records every cart/purchase request. |
| Shopper facing unavailable stock | Needed an honest incomplete result rather than a substitution claim. | The scenario suite checks an out-of-stock review result and zero cart/order writes. This case uses a controlled planner; broader model judgment on substitutions remains unproven. |
| Cautious browser user | A model could propose clicks despite an observe-only task. | Observe mode rejects interactions and blocks non-read network requests. |
| Browser navigating between sites | A redirect could bypass the initial origin check. | Browser network handling inspects redirects before following them; off-list navigation fails with setup guidance. |
| User interrupting a browser task | Replaying a task could add the same items twice. | Interrupted interactive browser nodes, including nested ones, participate in the existing explicit retry-review flow. Completed checkpoints are reused. |
| User moving work to another harness | Browser control introduced a new runtime dependency. | Browser skill ZIPs include the browser driver. An extracted skill completed a live Chrome task using a fixture model endpoint, without Jeeves or npm install. Chrome is still required. |
| Workflow designer | GitHub maintenance and shopping required a blank-canvas start. | Added GitHub maintenance and Grocery cart preparation to Explore and the checksum-validated public catalog. |
| User following a page link or returning to a view | In-app hash navigation did not switch views, and navigation replaced history. | Home/Explore/Editor now follow page links and browser Back; covered by a browser regression journey. |
| Advanced user | Malformed input surfaced a raw JSON parser error. | Home gives an actionable message and does not launch a run. |

## Evidence

- `npm test`: **67 passing tests**, including 12 persona scenarios and actual browser-driver/portable-runner integration.
- `npm run test:e2e`: **23 passing browser tests**, including 8 persona UX journeys.
- `npm run build`: TypeScript, web build, desktop runtime, and portable runner pass.
- `npm run check:catalog`: four valid workflow packages.
- [Real Codex run records](simulation-live-verification.json): GitHub maintainer **19.13 seconds**, grocery shopper **18.03 seconds**. These used synthetic local GitHub/shop data, actual Chrome, and the authenticated Codex CLI. Zero purchases or real repository writes.
- [Grocery browser screenshot](grocery-browser-simulation.png).
- [Packaged browser execution](packaged-browser-verification.json): the bundled Electron runtime launched real Chrome using its packaged browser driver, prepared a fixture cart, and returned review with zero purchases.
- [Updated Home](jeeves-abstract-home.png) and [practical starter marketplace](practical-workflow-marketplace.png).
- [Public GitHub check](github-read-verification.json): three issues read from `nodejs/node` through the workflow HTTP engine, with templated inputs and no credentials.

The abstract app icon replaces the earlier portrait; [artwork and generation prompts](../assets/brand/README.md) are preserved.

## Repeat the loop

1. Run `npm run build` and `npm run test:personas` for deterministic failures and UX journeys.
2. Run `npm run simulate:live` to exercise current model behavior against known synthetic tasks. This makes actual Codex calls and requires authentication. It writes a new report only after both tasks satisfy the checks.
3. Add a failing scenario before changing execution behavior; rerun affected scenarios, then the full unit/browser suite before packaging.

## Remaining limits

The browser runner has been tested against a local storefront, not Instacart, Amazon, or other real retailers. CAPTCHA, complex multi-domain authentication, iframes, unusual widgets, and retailer-specific purchase flows still need targeted tests. Native dropdowns and checkboxes were added and validated in the [second friction pass](USER_SIMULATIONS_2026-09-27.md). The grocery starter deliberately uses a placeholder URL until the user chooses a site. Website content and screenshots may contain account data; they are sent to the selected live provider.

Browser actions operate on observed DOM controls, with screenshots supplied to Codex. This is browser-scoped computer use, not arbitrary desktop control. Other providers currently receive DOM/text observations only. Checkout and sensitive-action guards use control names and destinations; they are useful review stops, not a security boundary against malicious page behavior. User review remains necessary. Observe mode blocks non-read HTTP methods, but websites can still implement side effects in GET requests.

At this first pass, the GitHub starter read up to 30 issues and 30 PRs. The [second friction pass](USER_SIMULATIONS_2026-09-27.md) adds bounded pagination and explicit partial-coverage reporting. It does not post comments, edit labels, or merge. Private repositories require a correctly scoped token. Live checks are examples, not a statistical quality benchmark. Human usability sessions, broader site coverage, and repeated model evaluations are the next evidence to collect.
