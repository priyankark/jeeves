import { writeFile, mkdir, readFile } from "node:fs/promises";
import { requestTriage } from "../../shared/triage-workflow.ts";
import { blank } from "../../shared/templates.ts";
import { validateGraph } from "../../shared/schema.ts";
const base = process.env.JEEVES_DEMO_URL || "http://127.0.0.1:4340";
const api = async (p, body) => {
  const r = await fetch(
    base + "/api" + p,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {},
  );
  const v = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(v));
  return v;
};
let report;
try {
  report = JSON.parse(
    await readFile("marketing/video/live-audit.json", "utf8"),
  );
} catch {
  report = { testedAt: new Date().toISOString(), cases: [], generation: [] };
}
const save = () =>
  writeFile(
    "marketing/video/live-audit.json",
    JSON.stringify(report, null, 2) + "\n",
  );
for (const [name, request, expected] of [
  [
    "urgent",
    "Customers cannot sign in after this morning’s release. Every login returns HTTP 500 in Chrome and Safari. Please prepare an incident brief.",
    "urgent",
  ],
  [
    "routine",
    "The settings tooltip spells preferences incorrectly. Settings still work; nobody is blocked. Please draft a reply and a small fix ticket.",
    "routine",
  ],
  [
    "needs_information",
    "Something is wrong. Please sort it out.",
    "needs_information",
  ],
]) {
  if (report.cases.some((c) => c.name === name && c.passed)) continue;
  const r = await api("/runs", {
    workflow: requestTriage,
    mode: "live",
    input: { request },
  });
  let run = r;
  for (let i = 0; i < 150; i++) {
    run = await api("/runs/" + r.id);
    if (run.status !== "running") break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  const decision = run.nodes.triage.output;
  report.cases.push({
    name,
    runId: r.id,
    status: run.status,
    route: decision?.route,
    answer: decision?.answer,
    model: decision?.model,
    latencyMs: decision?.latencyMs,
    expected,
    passed:
      decision?.route === expected &&
      run.status === (name === "needs_information" ? "waiting" : "completed"),
  });
  console.log(JSON.stringify(report.cases.at(-1)));
  await save();
  if (name === "needs_information" && run.status === "waiting") {
    report.waitingRunId = r.id; // Keep this run waiting for the real recorded walkthrough.
  }
}
for (const message of [
  "Build a customer request triage workflow that routes outages to an incident brief, ordinary requests to a reply draft, and asks me when details are missing.",
  "Build a workflow that gathers product evidence, checks whether the comparison is supported, and either writes the comparison or asks me what to clarify. Use supplied notes, no web browsing.",
  "Build a simple workflow that translates supplied text into French and returns the translation. No review or routing needed.",
]) {
  if (report.generation.some((c) => c.request === message)) continue;
  const result = await api("/copilot", {
    message,
    workflow: blank,
    mode: "live",
    provider: "codex",
  });
  const decisions = result.workflow.nodes.filter(
    (n) => n.data.kind === "decision",
  );
  report.generation.push({
    request: message,
    message: result.message,
    decisions: decisions.map((n) => ({
      engine: n.data.decisionEngine,
      type: n.data.questionType,
      label: n.data.label,
    })),
    graphErrors: validateGraph(result.workflow),
  });
  console.log(JSON.stringify(report.generation.at(-1)));
  await save();
}
await mkdir("marketing/video", { recursive: true });
await writeFile(
  "marketing/video/live-audit.json",
  JSON.stringify(report, null, 2) + "\n",
);
if (
  report.cases.some((c) => !c.passed) ||
  report.generation
    .slice(0, 2)
    .some(
      (c) =>
        !c.decisions.some((d) => d.engine === "jev") || c.graphErrors.length,
    ) ||
  report.generation[2].decisions.length
)
  process.exitCode = 1;
