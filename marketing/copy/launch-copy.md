# Jeeves: launch copy

Archived drafts from September 27, 2026, before the public preview. Current copy: [Product Hunt](product-hunt.md), [Reddit](reddit-sideproject.md), and the [live website](https://jeeves-workflows.vercel.app/). The access and feature statements below describe that earlier draft and should not be reused without updating.

## The message

**Campaign line:** Turn repeat work into a workflow.

**Product descriptor:** Reusable AI workflows, on your desktop.

**Supporting line:** Get a useful result. See the steps. Run the process again with new input.

**Short bio:** Jeeves turns recurring AI work into workflows you can inspect, adjust, and reuse. Start with project notes and get a weekly update ready to review.

**One sentence:** Jeeves turns repeatable work into visible workflows of focused agents, decisions, and handoffs that you can run from chat, schedule, or export as skills.

**30-second introduction:**

Every week, you turn scattered project notes into an update. Jeeves gives that task a repeatable process: draft from your notes, check the draft against those notes, and return text you can review and copy. Start with a labeled example without connecting AI; use one AI connection for your own notes. Inspect or change the steps, then use the workflow again next week. Your workspace stays on your computer; cloud AI services receive task context.

## Short social posts

Each numbered post stands alone. Add a real demo or landing-page URL only once one exists. Do not link to the private repository for a general audience.

1. I’m building Jeeves to turn repeat AI work into a workflow you can keep. The first example takes project notes through drafting and checking to a weekly update. Try a labeled sample, then bring your own notes and AI connection. I’m looking for feedback on that first-use experience.

2. Give each agent a job. Give decisions a route. Keep the workflow for next time. That’s the idea behind Jeeves, a local-first desktop app I’m building for repeatable agent work.

3. A workflow worth keeping should be a workflow you can take with you. Jeeves exports a skill with its runner and requirements for use in a compatible harness. Bring the credentials and tools that workflow needs.

4. Local-first, with the details spelled out: Jeeves stores workflows, chats, and run history on your computer. Live cloud models still receive task context. No Jeeves account required.

5. A vague bug report needs its own route. In a live Jeeves test, adding an explicit “needs information” choice sent the report to a clarification specialist. Useful workflow design goes beyond a confidence threshold.

## Launch thread

**1 / Introducing the preview**
I’m building Jeeves: a local-first desktop app for agent workflows. The idea is simple: give each agent a clear job, connect the steps, and keep the process for next time.

**2 / Start where the task starts**
Home is a chat interface. Choose a saved workflow, describe the task, review the proposed input, and launch the run. You can open the graph whenever you want to inspect the process.

**3 / Make decisions explicit**
Jev handles typed decisions in the graph. Its answer selects the next branch. A workflow can send missing information to a clarification specialist and low-confidence judgments to review.

**4 / Reuse what you build**
Assign installed skills to agents. Schedule recurring runs while the local engine is running. Export the workflow as a portable skill with its runner and requirements.

**5 / Keep the boundaries clear**
The workspace is local. Cloud model steps still send context to their configured provider. External services may need accounts or API keys. There’s no hosted Jeeves account system.

**6 / What I want to learn**
I’m looking for feedback on repeatable tasks: maintainer briefs, bug triage, meeting follow-ups, and project updates. Which process would you want to turn into a workflow?

## LinkedIn / longer launch post

I’m building Jeeves, a local-first desktop app for the work you keep doing with AI agents.

The idea: turn a useful sequence of steps into a workflow you can inspect and run again.

You can start from chat, give each agent a focused role, and connect decisions and handoffs in a visual graph. Jev supplies typed judgments that choose the next branch. Installed skills add context to agents, and schedules make recurring work easier to revisit.

There’s also an export path: take a workflow as a portable skill, with a runner and explicit requirements, to a compatible harness.

In recent desktop testing, I created workflows for meeting actions, bug triage, and project updates. The testing also found things worth fixing: disconnected new nodes, a chat input that kept an unrelated example, and a decision that needed an explicit missing-information branch. Those are exactly the details that matter when a demo becomes a tool you use repeatedly.

Jeeves stores its workspace locally. Live cloud providers still receive task context. The current build is a product preview, tested on macOS Apple Silicon.

I’d like feedback from people already doing recurring work with agents: what would your first workflow be?

## Product listing draft

**Name:** Jeeves

**Tagline:** Turn repeat work into a workflow

**Description:**

Turn recurring AI work into a process you can inspect and reuse. Start with notes to a weekly update: draft, check, and review the result. Try a labeled sample without keys, then connect AI for your own input. Customize the steps, schedule future runs, or export a portable skill. Local-first; no Jeeves account required.

**Maker comment:**

I built Jeeves around a question: what happens after you find a useful way to get work done with agents?

I wanted that process to have a visible shape: focused roles, explicit context, decisions you can inspect, and an output you can review. I also wanted workflows to travel between the desktop and a harness, with their requirements included.

The preview supports chat launch, a visual editor, Jev routing, scheduling, agent skills, and portable exports. I’m most interested in feedback on whether those pieces make recurring work easier to set up and understand.

The current desktop build is verified on macOS Apple Silicon. Live providers need their own credentials, and schedules need the local engine running. Public distribution details will be added when available.

**Listing media order:** launch-wide.png → product-home.png → product-workflow.png → portable-wide.png → workflow-portrait.png.

## Short article / newsletter

### Good work. In good order. Introducing a preview of Jeeves.

A useful agent process often has more than one step. Gather the context. Ask a question of it. Decide what should happen next. Produce a draft. Review the result.

Jeeves gives that process a place to live.

It’s a local-first desktop app for building and running workflows of focused agents. Start from chat or open the graph. Give each agent a narrow task. Connect decisions, API actions, and handoffs. Follow the run and inspect the result.

Jev supplies typed judgments that select branches in the workflow. That makes a decision part of the process you can examine. In a bug-triage example, a checkout outage, a nonblocking typo, and an underspecified report each reached an appropriate specialist after refining the workflow’s criteria.

The design also pays attention to what happens after the first useful run. Install skills and assign them to the agents that need them. Schedule recurring work while the local engine runs. Export a workflow as a portable skill with a bundled runner, sample input, and explicit requirements. A compatible harness can execute it without the Jeeves desktop app staying open.

Local-first has a concrete meaning here: workflows, conversations, and run history are stored on your computer. Live cloud models receive the context required for their steps. You bring the provider credentials and tools your workflow uses; there is no separate Jeeves account.

The current product is a preview, with desktop testing on macOS Apple Silicon. The next useful conversation is about a real recurring task: a maintainer brief, a meeting follow-up, or a project update. What would you put in good order?

## Outreach drafts: not sent

### Personal demo invitation

**Subject:** A workflow for the agent task you repeat

Hi [name],

I’m building Jeeves, a local-first desktop app for agent workflows. It connects focused agents, decisions, and handoffs, with chat launch and portable skill export.

I thought of your work on [specific recurring task]. Would you be interested in a short walkthrough using a synthetic example of that process? I’d particularly value feedback on where the setup or result is hard to follow.

Best,
[sender]

### Maintainer / developer-community introduction

**Subject:** Jeeves preview: visible workflows for focused agents

Hi [name],

I’m working on a desktop workflow tool called Jeeves. One example reads repository issues and pull requests to prepare a maintainer brief; it does not submit comments, labels, or merges.

The app combines a visual graph, chat launch, typed Jev decisions, scheduling, and portable skill exports. The current build is a preview.

If this overlaps with your community’s interests, I can share a short product walkthrough and would welcome candid feedback. No endorsement expected.

[sender]

## Available assets

- `exports/launch-wide.png`: lead announcement graphic.
- `exports/launch-square.png`: square campaign graphic.
- `exports/portable-wide.png`: portable-skills feature graphic.
- `exports/workflow-portrait.png`: vertical product graphic.
- `exports/repository-preview.png`: repository/social preview graphic; suitable for private repository metadata too.
- `exports/jeeves-one-pager.pdf`: follow-up after a product conversation.
- `exports/jeeves-product-deck.pdf`: product walkthrough.

No invented customer counts, time savings, partnerships, waitlist, or public-download claims are included.
