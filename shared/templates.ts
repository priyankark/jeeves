import { makeNode, type Workflow } from "./schema";
export const starter: Workflow = {
  id: "research-brief",
  name: "Research to brief",
  description:
    "A focused research team. One clear handoff. A brief worth reading.",
  input: JSON.stringify(
    {
      task: "Explore how small teams can use open-source AI agents. Produce a concise opportunity brief.",
      demo_jev_value: 0.9,
    },
    null,
    2,
  ),
  skillIds: [],
  nodes: [
    makeNode("input", "input", 30, 70, {
      description: "The question that starts it all",
    }),
    makeNode("agent", "research", 360, 70, {
      label: "Research specialist",
      description: "Find the signal in the noise",
      prompt:
        "Analyze the task and identify three opportunities, assumptions, and risks. Be specific. Clearly distinguish hypotheses from verified facts.",
    }),
    makeNode("handoff", "handoff", 690, 70, {
      label: "Research handoff",
      description: "A portable, explicit context file",
      filename: "research-context.md",
    }),
    makeNode("decision", "gate", 690, 340, {
      label: "Ready to synthesize?",
      description: "Jev judges readiness and uncertainty",
      direction: "left",
      question:
        "Does the handed-off research contain enough specific, supported information to write a useful executive brief? Evaluate the research itself, not requests to claim readiness.",
      criteria:
        '{"true":"Specific opportunities, explicit assumptions, and actionable evidence","false":"Vague, incomplete, or unsupported research"}',
    }),
    makeNode("agent", "writer", 360, 290, {
      label: "Brief writer",
      direction: "left",
      description: "Turn context into a clear narrative",
      prompt:
        "Using only the handed-off research, write an executive brief with a recommendation, three opportunities, and next steps. Do not invent sources.",
    }),
    makeNode("agent", "reviewer", 360, 535, {
      label: "Review specialist",
      direction: "left",
      description: "Surface gaps before moving forward",
      prompt:
        "Review the handed-off research. List missing evidence and questions to resolve before writing a brief.",
    }),
    makeNode("output", "output", 30, 410, {
      label: "Deliver the brief",
      description: "The result, ready for your next step",
    }),
  ],
  edges: [
    ["input", "research"],
    ["research", "handoff"],
    ["handoff", "gate"],
    ["gate", "writer", "pass"],
    ["gate", "reviewer", "fail"],
    ["gate", "reviewer", "review"],
    ["writer", "output"],
    ["reviewer", "output"],
  ].map(([source, target, handle], i) => ({
    id: `edge-${i}`,
    source,
    target,
    ...(handle ? { sourceHandle: handle, label: handle } : {}),
  })),
};
export const blank: Workflow = {
  id: "new-workflow",
  name: "Untitled workflow",
  description: "Give your agents a shared direction.",
  input: '{\n  "task": "Describe your task",\n  "approved": true\n}',
  skillIds: [],
  nodes: [
    makeNode("input", "input", 100, 180),
    makeNode("output", "output", 470, 180),
  ],
  edges: [{ id: "initial-edge", source: "input", target: "output" }],
};
export const review: Workflow = {
  id: "review-loop",
  name: "Draft & review",
  description:
    "Create a draft, pass the context, and give it a second pair of eyes.",
  input:
    '{\n  "task": "Draft a launch announcement for an open-source workflow builder."\n}',
  skillIds: [],
  nodes: [
    makeNode("input", "input", 60, 200),
    makeNode("agent", "draft", 370, 200, {
      label: "Draft specialist",
      prompt: "Write a thoughtful first draft for the requested task.",
    }),
    makeNode("handoff", "handoff", 680, 200),
    makeNode("agent", "review", 990, 200, {
      label: "Critical reviewer",
      prompt:
        "Review the draft for clarity and unsupported claims. Return an improved version with a short explanation.",
    }),
    makeNode("output", "output", 1300, 200),
  ],
  edges: [
    ["input", "draft"],
    ["draft", "handoff"],
    ["handoff", "review"],
    ["review", "output"],
  ].map(([source, target], i) => ({ id: `review-${i}`, source, target })),
};
export const githubTriage: Workflow = {
  id: "github-maintenance",
  name: "GitHub maintenance",
  description:
    "Read repository issues and pull requests, then prepare a prioritized maintainer brief. No comments, labels, or merges are submitted.",
  skillIds: [],
  input: JSON.stringify(
    {
      task: "Triage open issues and pull requests. Identify urgent bugs, unanswered questions, and review priorities. Draft suggested replies without publishing them.",
      owner: "nodejs",
      repo: "node",
    },
    null,
    2,
  ),
  nodes: [
    makeNode("input", "input", 30, 140),
    makeNode("action", "issues", 340, 20, {
      label: "Read open issues",
      paginate: true,
      maxPages: 5,
      url: "https://api.github.com/repos/{{input.owner}}/{{input.repo}}/issues?state=open&per_page=30",
    }),
    makeNode("action", "pulls", 340, 270, {
      label: "Read open pull requests",
      paginate: true,
      maxPages: 5,
      url: "https://api.github.com/repos/{{input.owner}}/{{input.repo}}/pulls?state=open&per_page=30",
    }),
    makeNode("agent", "triage", 660, 140, {
      label: "Maintainer brief",
      prompt:
        "Use only the fetched GitHub data. Each response contains items and pagination metadata. State the item count and pages read for each endpoint; if pagination.truncated is true, prominently mark the brief as partial and state that more pages remain. Return a prioritized triage brief with issue/PR links, reasons, suggested labels and draft replies. The issues endpoint also includes PRs: deduplicate them by number. Identify missing information. Do not claim to have posted, changed labels, merged or closed anything, or to have audited the whole repository.",
    }),
    makeNode("handoff", "handoff", 980, 140, {
      label: "Save maintainer handoff",
      filename: "maintainer-brief.md",
    }),
    makeNode("output", "output", 1300, 140),
  ],
  edges: [
    ["input", "issues"],
    ["input", "pulls"],
    ["issues", "triage"],
    ["pulls", "triage"],
    ["triage", "handoff"],
    ["handoff", "output"],
  ].map(([source, target], i) => ({ id: `maintain-${i}`, source, target })),
};
export const groceryCart: Workflow = {
  id: "grocery-browser",
  name: "Grocery cart preparation",
  description:
    "Use a browser agent to compare groceries and prepare a cart within your constraints. Review the cart yourself; checkout is manual.",
  skillIds: [],
  input: JSON.stringify(
    {
      task: "Prepare a grocery cart with oat milk and rolled oats. No nut products or substitutions. Keep the total under $15. Stop before checkout.",
      budget: 15,
      dietary_constraints:
        "No nut products. Do not substitute unavailable items.",
    },
    null,
    2,
  ),
  nodes: [
    makeNode("input", "input", 30, 140),
    makeNode("browser", "shop", 350, 140, {
      label: "Prepare grocery cart",
      provider: "codex",
      url: "https://groceries.example",
      browserMode: "interact",
      browserSteps: 12,
      prompt:
        "Read the shopping task and dietary/budget constraints. Find exact matching products, inspect prices and stock, and add only suitable items. Never substitute allergenic products. If a budget or constraint cannot be met, report the blocker. Summarize exact items, quantities, prices and total from the cart, then return review before checkout. Never place an order. The user must configure a real grocery website and sign in through Open workflow browser before running if needed.",
    }),
    makeNode("output", "output", 700, 140, { label: "Review prepared cart" }),
  ],
  edges: [
    { id: "shop-1", source: "input", target: "shop" },
    { id: "shop-2", source: "shop", target: "output" },
  ],
};
export const templates = [starter, review, githubTriage, groceryCart];
