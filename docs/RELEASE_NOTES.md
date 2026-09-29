Jeeves desktop preview: turn repeat work into a workflow.

Start with **Try the example** to turn sample project notes into a weekly update without an API key. Add your own notes and connect one AI service when ready. Inspect and edit the steps, collect input during a run, and reuse the process.

## First-run setup and open source preparation

- A welcome screen explains the workflow and offers a sample without keys or guided AI setup.
- Connect Jev with a TypeSafe key and choose OpenAI, Codex CLI, OpenRouter, or a local model for agent steps. Save and verify each connection without leaving setup.
- Skip setup, return from Home, and keep existing workspaces opening directly. Failed checks stay visible and no longer show a green connection badge.
- Jeeves and its starter workflows now use Apache 2.0. Installers and portable runners include the license and notices. Third-party packages and skills retain their licenses.
- Browser checks cover first-run setup, rejected and corrected credentials, keyboard navigation, existing users, and a sample on a small laptop screen.

## Give Jev the decisions

- The builder now uses explicit Jev branches for triage, evidence checks, readiness, and quality, with actionable review paths. Simple transformations can remain linear; human approval remains an input request.
- A new **Request triage · Jev** starter routes urgent and routine requests to focused agents and pauses for clarification on missing information or low confidence. It is available in Templates and Explore.
- Verified with three live Jev classifications, the full human-input handoff, and generated workflows that use decisions only where needed.

## More reliable browser control

- When a retailer replaces or covers a control, Jeeves refreshes its page view and replans up to three times per action instead of failing with a locator timeout.
- Product links with partially covered click areas use an exposed, verified point on the selected link; clicks are never forced through overlays.
- Recovery does not consume the configured action budget. Repeated instability pauses with a current screenshot and a clear next action.
- If an action was dispatched but its result is uncertain, Jeeves pauses without repeating it.
- Observed page text and source URLs are retained across browser steps and human handoffs, so the agent can avoid repeated searches and pass real evidence to later workflow steps. The record is capped at 30 pages and 8,000 characters per page.
- Browser time limits scale with the configured step count, up to ten minutes, while Stop remains available.
- Verified against a real Costco search and product navigation, plus browser tests for rerenders, covering popups, and uncertain actions.

## Waiting for you

- Browser findings and input prompts now render paragraphs, lists, headings, and tables. Long findings can be collapsed, and bare source URLs have compact labels with their full destination available on hover.
- Browser requests for login, missing information, or review now pause the run durably instead of reporting completion and running later steps.
- Open the saved browser to take action, then explicitly continue the browser task or accept its result. Accepting a result never performs checkout.
- Input forms include a sound toggle. Enabled alerts chime once per new request; reading an alert never resumes a run.
- The marketplace grocery workflow now collects and validates the shopping list, budget, ZIP code, and preferences before opening the store.

## Choose your download

| System | Download | Install |
| --- | --- | --- |
| Mac with Apple Silicon (M-series) | `mac-arm64.dmg` | Open the disk image and drag Jeeves to Applications |
| Mac with Intel | `mac-x64.dmg` | Open the disk image and drag Jeeves to Applications |
| Windows x64 | `win-x64.exe` | Run the installer; installation is per user |
| Linux x64 (Debian/Ubuntu) | `linux-amd64.deb` | Install with your package manager |
| Linux x64 (portable) | `linux-x86_64.AppImage` | Make executable and run; some systems require FUSE |

Node.js and npm are bundled/not required for desktop use. Browser workflows additionally need Google Chrome. Live AI services require their own credentials or a configured local model.

## Preview limitations

- These builds are not signed with a trusted publisher certificate or notarized. macOS Gatekeeper and Windows SmartScreen may require explicit approval. macOS builds have a local ad-hoc signature only. Use these previews only if you trust this repository and the attached checksums.
- Quit an older Jeeves build before opening the new one. Updates are manual; automatic updating is not implemented.
- Workflows, conversations, and provider settings stay in your local workspace. Installing an update does not intentionally replace them. Keep a backup before trying a preview.
- Source and preview downloads are public under Apache 2.0. Start with the [quick start](https://github.com/priyankark/jeeves/blob/main/docs/QUICKSTART.md).
- Packaged-app smoke tests cover startup, the isolated local engine, and the sample workflow on each platform. They do not establish real-provider answer quality or real retailer shopping reliability.

`SHA256SUMS.txt` and per-file `.sha256` files verify the attached downloads. Build provenance and packaged-app smoke reports are available in the **Desktop installers** Actions run for this tag.
