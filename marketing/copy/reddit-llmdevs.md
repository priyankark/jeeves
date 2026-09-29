# r/LLMDevs launch post

Published from **u/yotta_mind** with the Tools flair. [Read the post](https://www.reddit.com/r/LLMDevs/comments/1wtgo9d/i_built_jeeves_an_open_source_workflow_app_with/). Author and full post verified while signed out on September 29, 2026. Edit the existing post rather than submitting a duplicate.

## Title

I built Jeeves, an open source workflow app with Jev routing and human input

## Post

Hi, I'm building Jeeves, a desktop app for saving and running productivity workflows. It's free under Apache 2.0, with no paid app tier. I wanted to share how the decision and human-input steps work.

Jev, TypeSafe's decision model, answers a question with defined outcomes. You connect those outcomes to agent steps. For example, a request can go to an incident agent, a routine-task agent, or back to you for missing details. Agents handle the writing, research, or browser work. The run inspector shows the decision and the route it chose.

A few details from the implementation:

- Choice and score answers are checked against the configured criteria. Unknown choices or invalid probability maps fail validation. Answers below the configured confidence threshold take the review route. That threshold is a routing setting, not a guarantee of correctness.
- Human input is saved as a waiting step. The run keeps its progress, and dependent steps wait for a submitted answer. There isn't a worker sitting open until someone replies.
- Browser tasks can also pause for login or review. If a browser action was sent but its result is uncertain, the run pauses for inspection instead of automatically repeating the action.

The built-in example runs on sample data without API keys. It helps you inspect the workflow, but doesn't test a live model's accuracy. Live Jev decisions need a TypeSafe key; agent steps use your chosen provider or local model. Provider charges are separate.

Source and setup: https://github.com/priyankark/jeeves

The routing code is in `server/jev.ts`; execution and waiting are in `server/engine.ts`.

Demo and downloads: https://getjeeves.app/

It's an early preview for Mac, Windows, and Linux. Mac builds are signed and notarized. Windows is unsigned, updates are manual, and browser automation still needs human help at times.

Disclosure: I'm the creator of Jeeves. This post was drafted with help from Codex.

## Posting notes

The current rules and pinned policy update allow free FOSS projects without prior moderator approval. Disclose authorship, AI writing assistance, provider costs, and preview limits. This is a project introduction, not a disguised survey. Do not request votes or duplicate the post.

Checked September 29, 2026:

- https://www.reddit.com/r/LLMDevs/about/rules.json
- https://www.reddit.com/r/LLMDevs/comments/1mvuw5x/community_rule_update_clarifying_our/
