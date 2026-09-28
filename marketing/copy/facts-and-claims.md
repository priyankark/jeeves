# Product facts for marketing

Snapshot: September 27, 2026. Use this to keep future edits consistent with the product. Evidence references point to the repository alongside this kit; they are not needed to open the exported PDFs or graphics.

| Topic | Supported wording | Important qualification | Evidence |
| --- | --- | --- | --- |
| Product | Local-first desktop app for agent workflows | Current verified desktop build is macOS Apple Silicon; unsigned | `README.md`, `docs/PRODUCT_VERIFICATION.md` |
| Home chat | Choose or describe a task, review its input, then start a workflow | Chat does not silently launch the work; live preparation can call a model | `src/Home.tsx`, `server/chat.ts` |
| Local-first | Workflows, chats, and run history are stored locally | Live cloud providers receive task context; this is not an offline-only guarantee | `server/storage.ts`, `server/providers.ts` |
| Accounts | No Jeeves account required | Providers and external services may need credentials or accounts | `README.md` |
| Models | Supported cloud APIs, local compatible model servers, and Codex CLI | Model/provider support is configured per step; no claim of every model or every harness | `server/providers.ts` |
| Decisions | Jev provides typed judgments that select branches | Confidence does not guarantee accuracy; missing information may need an explicit route | `docs/UX_CREATION_REVIEW.md`, `server/jev.ts` |
| Skills | Install skills from supported public GitHub sources; assign at workflow or agent level | Bundled skills retain their licenses; API agents do not gain arbitrary script-execution tools | `server/skills.ts`, `README.md` |
| Portability | Export a skill with a bundled runner and requirements | Requires compatible harness, Node.js 22.12+, permissions, credentials, and workflow-specific tools | `docs/PRODUCT_VERIFICATION.md`, `server/packages.ts` |
| Scheduling | Schedule recurring local workflows | The local engine must run; no always-on cloud scheduler is provided | `server/scheduler.ts`, `README.md` |
| Marketplace | File-based workflow packages and public GitHub catalogs | No hosted marketplace with network-effect or user-count claims; current project repo is private | `server/workflow-market.ts` |
| Browser tasks | Separate Chrome session for bounded browser interaction | Human handles sign-in/MFA and checkout; real retailer reliability is unproven | `docs/CUA_SIGN_IN.md` |
| Verification | Agent-operated desktop exploration and automated checks | Not a human usability study, customer validation, or general model benchmark | `docs/UX_CREATION_REVIEW.md` |
| Source | Repository contains an MIT license | Repository is private. Do not describe it as publicly available open source until visibility changes | `LICENSE`, latest user instruction |

## Avoid in current materials

- “Works with every harness”, “just add an API key”, or “runs anywhere”.
- “Your data never leaves your computer” or “fully offline” for live cloud workflows.
- “Fully autonomous shopping”, “automatic checkout”, or “works with any website”.
- “Human approval queue” as an existing workflow feature; it is not implemented as a durable pause/resume queue.
- Performance comparisons, hours saved, customer testimonials, adoption metrics, and provider endorsements without evidence.
- Public download links, a functioning waitlist, hosted signup, or public GitHub access that does not exist.
- Claims that the fresh kit screenshots depict live model runs: they depict the actual product in Demo mode.

## Copy status

All copy is suitable for a preview conversation. The kit contains no signup form, tracking, analytics, external fonts, or publishing integration. Replace distribution language only after an actual distribution channel exists. Publishing or sending these materials is separate from their preparation.
