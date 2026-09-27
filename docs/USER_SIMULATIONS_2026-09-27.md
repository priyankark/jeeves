# Second friction pass — September 27, 2026

This pass used automated scenarios, a real Codex harness, and installed Chrome. These are simulated user journeys, not interviews or a human usability study.

## Findings and changes

| Scenario | Friction | Change |
| --- | --- | --- |
| Shopper wants two bottles with no substitutions | The browser could click and type but could not select quantities or set checkboxes reliably | Added native dropdown selection and explicit checkbox state, with option values and checked state in observations |
| Shopper encounters unavailable stock | Disabled options and controls looked actionable; hidden controls could add noise | Exposed disabled state, rejected unavailable selections, and excluded hidden/inert controls |
| Agent reads a wrapping form label | Dropdown options became part of the control name | Accessible names now exclude nested form controls and support `aria-labelledby` |
| Shopper reviews an interrupted task | Failure lost the screenshot link, and the saved profile was buried in the editor | Failed runs preserve the last available screenshot; Home and the inspector offer a direct Review browser action |
| User cancels while the planner is responding | A late planner response could still report success | Recheck cancellation before executing or accepting the returned action |
| Maintainer audits a busy repository | The starter only read the first page and could imply complete coverage | Follow same-origin next-page links, expose page/item counts and truncation, and require partial-coverage language in the brief |
| Maintainer adjusts API pagination | No visible pagination setting or page budget | Added GET-only pagination and a maximum-page field; switching to POST clears pagination |

Browser review resolves the original run's saved workflow and URL, so subsequent edits do not redirect review to a different node. Active runs cannot open a competing review session. An open manual session must be closed before the same step runs again.

## Repeatable checks

- `npm test`: **82 passing tests**, covering browser controls, unavailable options, cancellation, failed-run artifact persistence, saved-session recovery, and HTTP pagination regressions alongside the existing suite.
- `npm run test:e2e`: **25 passing tests**, covering pagination editing/save/reload and failed-run review/screenshot affordances alongside existing UX journeys. An earlier run had apparent system-suspension timeouts; the uninterrupted rerun passed in 45.3 seconds.
- `npm run check:catalog`: bundled marketplace integrity.
- `npm run simulate:live:depth`: authenticated Codex and actual Chrome on a synthetic store, plus read-only public GitHub pagination.

Pagination follows the [GitHub next-page convention](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api). Tests cover cross-origin links, embedded credentials, repeated links, rate limits, cancellation, array validation, and bounded partial results. Ordinary non-paginated HTTP output remains unchanged.

## Live evidence

The Codex grocery run took 25.93 seconds. It selected quantity **2**, unchecked **Allow substitutions**, added the configured oat milk, and returned a review result showing **$8**, below the **$10** budget. Reopening the same browser profile displayed `Cart: 2 bottles. Substitutions: false`. The fixture recorded one cart write and **zero purchases**.

The public `nodejs/node` GitHub check fetched two pages with one record per page, without credentials. It returned two records and `truncated: true` with a next-page link, demonstrating explicit partial coverage.

- [Machine-readable live results](simulation-depth-live-verification.json)
- [Restored grocery cart screenshot](grocery-options-live.png)

## Desktop handoff correction

The user could not find the new workflows in their workspace. The bundled Explore catalog contained them, but no saved copies had been installed in the existing desktop workspace. Installed **GitHub maintenance** and **Grocery cart preparation** there, selected the already configured Codex provider for their agent steps, and refreshed the packaged app. This was a delivery gap: catalog availability does not imply visibility in the user's saved-workflow list.

## Remaining limits

The grocery fixtures validate native controls and session persistence. They do not establish compatibility with real grocery retailers, CAPTCHAs, iframes, custom widgets, or multi-domain login flows. The browser runner operates browser pages, not arbitrary desktop applications. No purchase or repository write was made during these checks.

Pagination currently requires JSON-array responses and a `Link` next-page header. It is bounded to 20 pages, 1 MB per response, 5 MB aggregate, and 10,000 items; the starter defaults to five pages of 30 records per endpoint. A draft maintenance brief is not an exhaustive repository audit. Existing installed copies of the starter retain their saved settings; the updated template is available in Explore.
