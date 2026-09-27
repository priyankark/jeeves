## Jeevs

The jev based orchestrator for complex, multi-harness and multi-model workflows

## Ingedients
- TypeSafe: https://console.typesafe.ai/playground
- Open AI APIs
- Open Router
- UX libraries and Electron

## What?
- Visual Graph based UX with a side-pane Copilot where users can define workflows
- Primitives (Nodes) such as jev decision blocks,handoff block, subagent block, Action/Connector block, Workflow block
- Jev acts as conditional to other nodes.
- Handoff is a file with set of context that the next node will use. Maybe subagents write it.
- You can have nodes that are subagents based off a harness such as codex as well
- Everything works super well with open source models as well
- A node can also directly be the action/API call in itself without needing any more agentic loops
- Nodes can also just be another workfow which internally is all of this once again

## Philosophy
Subagents focus on one task and handoff to other subagents. Keeps them highly focused.
