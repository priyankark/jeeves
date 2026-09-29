# Reddit launch draft

Target: r/SideProject. Check its sidebar, posting form, pinned threads, and current rules again on launch day. This draft has not been posted. Use it only after the repository and downloads are public.

## Title

I gave my recurring AI tasks a Jeeves. It is an open source desktop workflow app.

## Post

My AI routine was becoming a small clerical occupation: paste the notes, explain the task, ask for a draft, check it, repeat next week. So I built Jeeves to keep the process.

Your to-do list has acquired staff, as it were.

You describe the work, review the steps, and run it on your computer. Each agent has a focused job. Jev, a decision model from TypeSafe, can choose a route or check whether the work is ready. If the workflow needs your input, it saves its progress and waits for your answer.

One example is request triage: an urgent issue goes to an incident agent, a routine question goes to a reply writer, and an unclear request comes back to you for more detail. You can see the decision and the output at each step.

Jeeves is open source under Apache 2.0. The sample works without API keys. For live work, connect OpenAI, Codex CLI, OpenRouter, or a local model. Jev decisions use a separate TypeSafe key. Hosted services have their own costs. Workflows and history stay on your computer; cloud providers receive the task context you send them.

It is an early desktop preview for Mac, Windows, and Linux. The installers are not yet signed with a trusted publisher certificate. Browser tasks can need a manual login or review.

Demo and setup: https://jeeves-workflows.vercel.app/

Code and downloads: https://github.com/priyankark/jeeves

The name owes a little to P. G. Wodehouse and a little to the spelling of Jev. The app is still working on the unflappable manner. It does already know that asking a question means waiting for the answer.

I would like feedback on the first-run setup and whether the steps make sense. What repeat task would you try first?

## Posting notes

Post once from the maker's account. Answer questions with specific examples and known limits. Do not request votes or send unsolicited messages. Do not cross-post this draft to r/opensource: its rules prohibit AI-generated content. Follow each community's own rules.

Rules checked September 28, 2026:

- https://www.reddit.com/r/SideProject/about/rules.json
- https://www.reddit.com/r/opensource/about/rules.json
