# r/LLMDevs launch post

Published from **u/yotta_mind** with the Tools flair. [Read the post](https://www.reddit.com/r/LLMDevs/comments/1wtgo9d/i_built_jeeves_an_open_source_workflow_app_with/). Author and full post verified while signed out on September 29, 2026. Edit the existing post rather than submitting a duplicate.

## Title

I built Jeeves, an open source workflow app with Jev routing and human input

## Post

Hi, I'm building Jeeves, a desktop app for saving everyday tasks as reusable AI workflows. It's free under Apache 2.0, with no paid app tier.

For example, a weekly update can have four steps: read your project notes, draft the update, check it against the notes, and let you review it. Save that workflow and run it next week with new notes. You can change the steps in a visual editor and inspect each step's inputs and results.

Agent steps handle writing, research, or browser work using the provider you connect. Human-input steps collect answers and pause the work that depends on them. For tasks with different paths, Jev, TypeSafe's decision model, can classify a request or check a draft and choose the next step.

A few implementation details:

- Human input is saved as a waiting step. The run keeps its progress, and dependent steps wait for a submitted answer. There isn't a worker sitting open until someone replies.
- Browser tasks can pause for login or review. If an action was sent but its result is uncertain, the run pauses for inspection instead of automatically repeating it.
- Decision outputs are validated against the configured choices or scoring criteria. Low-confidence answers take a review route. That threshold is a routing setting, not a guarantee that the answer is correct.

The built-in example uses sample data and needs no API key. It demonstrates the workflow, not live model accuracy. For your own tasks, connect an AI provider or local model. Live Jev decisions need a TypeSafe key. Provider charges are separate from the free app.

Source and setup: https://github.com/priyankark/jeeves

Execution and waiting are in `server/engine.ts`; decision validation is in `server/jev.ts`.

Demo and downloads: https://getjeeves.app/

It's an early preview for Mac, Windows, and Linux. Mac builds are signed and notarized. Windows is unsigned, updates are manual, and browser tasks sometimes need human help. Your workspace stays on your computer; cloud providers receive the task context you send them.

Disclosure: I'm the creator of Jeeves. This post was drafted with help from Codex.

## Posting notes

Body revised on September 29, 2026 to lead with recurring tasks and a weekly-update example. Verified publicly after saving. The published title remains unchanged because Reddit does not allow title edits.

The current rules and pinned policy update allow free FOSS projects without prior moderator approval. Disclose authorship, AI writing assistance, provider costs, and preview limits. This is a project introduction, not a disguised survey. Do not request votes or duplicate the post.

Checked September 29, 2026:

- https://www.reddit.com/r/LLMDevs/about/rules.json
- https://www.reddit.com/r/LLMDevs/comments/1mvuw5x/community_rule_update_clarifying_our/
