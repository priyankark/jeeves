# Reddit launch draft

Target: r/SideProject. Check its sidebar, posting form, pinned threads, and current rules again on launch day. This draft has not been posted. Use it only after the repository and downloads are public.

## Title

I built an open source app for productivity workflows

## Post

I kept giving AI the same instructions every week: read my notes, draft an update, check it, and ask me about anything missing. I built Jeeves so I could save those steps and run them again with new notes.

You describe the work, review the steps, and run it on your computer. Each agent has a focused job. Jev, a decision model from TypeSafe, can choose a route or check whether the work is ready. If the workflow needs your input, it saves its progress and waits for your answer.

One example is request triage: an urgent issue goes to an incident agent, a routine question goes to a reply writer, and an unclear request comes back to you for more detail. You can see the decision and the output at each step.

Jeeves is open source under Apache 2.0. The built-in example uses sample data and makes no AI calls. For live work, connect OpenAI, Codex CLI, OpenRouter, or a local model. Jev decisions use a separate TypeSafe key. Hosted services have their own costs. Workflows and history stay on your computer; cloud providers receive the task context you send them.

It is an early desktop preview for Mac, Windows, and Linux. The installers are unsigned and not notarized, and updates are manual. Browser tasks can need a login or manual review and may fail when a website changes.

Demo and setup: https://getjeeves.app/

Code and downloads: https://github.com/priyankark/jeeves

The name refers to P. G. Wodehouse’s Jeeves, the resourceful valet who gets Bertie Wooster out of trouble. It also fits the Jev model connection.

I would like feedback on the first-run setup and whether the steps make sense. What repeat task would you try first?

## Posting notes

Post once from the maker's account. Answer questions with specific examples and known limits. Do not request votes or send unsolicited messages. Do not cross-post this draft to r/opensource: its rules prohibit AI-generated content. Follow each community's own rules.

Rules checked September 28, 2026:

- https://www.reddit.com/r/SideProject/about/rules.json
- https://www.reddit.com/r/opensource/about/rules.json
