# Amazon grocery shopper

Created through Jeeves's live Copilot and applied through the UI in the installed desktop workspace on September 27, 2026.

- Workflow: **Amazon grocery shopper**
- ID: `63d474f9-e8c7-4f4d-b001-69e75aa04431`
- Definition: [amazon-grocery-shopper.json](amazon-grocery-shopper.json)
- Flow: Grocery shopping input → Shop Amazon Fresh → Cart report and human review
- Browser: Codex CLI with page screenshots and observed browser controls; Interact mode; maximum 30 steps per run; persistent, separate browser profile.

## Ready and verified

The workflow is saved in the installed Jeeves app. Its schema and graph validate without errors. The real Amazon Fresh storefront loads, and CUA reached the sign-in handoff. Jeeves reports that it has stopped observing the browser while the user signs in. [Handoff evidence](amazon-login-verification.json), [Jeeves screenshot](57-amazon-signin-handoff.png).

Website access was configured through Settings for `https://www.amazon.com`, `https://images-na.ssl-images-amazon.com`, `https://m.media-amazon.com`, and `https://s.amazon-adsystem.com`. Existing website permissions were retained; unrestricted access was not enabled.

## Still required for the shopping run

The user must supply a grocery list with quantities, a positive USD budget, and delivery ZIP code, and finish Amazon sign-in in the visible Chrome window. Amazon Fresh is the current store; the user has been asked whether they prefer Fresh or Whole Foods. Diet and substitution preferences can also be supplied. No grocery run has completed and no products have been added by this workflow yet.

The saved input deliberately contains an empty list and ZIP and a zero budget rather than invented shopping instructions. The browser prompt requires clarification before cart changes when these values are missing. This requirement is a model instruction, not separate deterministic input validation.

The task instructions require checking stock, size, prices, and dietary fit; preserving existing cart items; avoiding duplicate additions; and reporting observed additions, subtotals, unresolved items, and unknown fees. They stop before checkout, ordering, and subscriptions. Actual cart behavior remains unverified until a live shopping run is possible.

## Usability failures encountered on the real site

1. **Allowing Amazon's main domain did not make Amazon usable.** Styles/scripts/images on separate Amazon domains were silently blocked. A hidden overlay remained active on an unstyled page and intercepted the sign-in click. [Broken page](amazon-missing-assets.png), [page after asset access](amazon-assets-loaded.png).
2. **A blocked embedded advertising frame terminated the whole browser task.** Jeeves surfaced “Navigation to https://s.amazon-adsystem.com needs permission” during sign-in. The user had to grant another domain and retry. Optional frame failures should not be treated like main-page navigation failures.
3. **The click error exposed a raw Playwright call log and ANSI escape sequences.** Its long content caused horizontal overflow in the inspector. The UI needs a short explanation, a recovery action, and technical details behind an expandable control. [Screenshot](51-retry-amazon-login-position.png).
4. **The Copilot's proposal remained below the visible scroll area.** The assistant had finished, but the panel still showed its introductory content and the start of the user's request until manually scrolled. [Before scroll](39-amazon-proposal.png), [proposal revealed](40-amazon-apply-proposal.png).

These are observed product issues. This pass worked around the domain problem using settings; it did not modify Jeeves's browser engine or error rendering.
