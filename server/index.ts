import { finishManualBrowser } from "./browser";
import {
  previewPackage,
  validatePackage,
  importPackage,
  skillArchive,
  secretFindings,
  requirements,
  slugify,
} from "./packages";
import { workflowCatalog, marketplacePackage } from "./workflow-market";
import {
  chatInput,
  chatLock,
  readChat,
  deleteChat,
  planChat,
  applyChatConnection,
} from "./chat";
import type { ChatSession } from "../shared/packages";
import { idSchema } from "../shared/schema";
import {
  loadIntegrations,
  integrationStatus,
  saveIntegrations,
} from "./integrations";
import { openWorkflowBrowser } from "./browser";
import {
  currentLogins,
  startLogin,
  loginStatus,
  finishLogin,
  focusLogin,
} from "./browser-login";
import { interpolate } from "./action-context";
import { zipSync, strToU8 } from "fflate";
import { createHash } from "node:crypto";
import { Scheduler, previewOccurrences } from "./scheduler";
import {
  catalog,
  previewSkill,
  installSkill,
  installedSkills,
  removeSkill,
  resolveSkills,
} from "./skills";
import "dotenv/config";
import packageMetadata from "../package.json";
import {
  loadConnections,
  saveConnection,
  checkConnection,
  connectionProvider,
} from "./connections";
import express from "express";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { existsSync } from "node:fs";
import { z } from "zod";
import {
  workflowSchema,
  validateGraph,
  providerSchema,
  type Workflow,
  type Run,
} from "../shared/schema";
import { starter, review } from "../shared/templates";
import {
  createRun,
  executeRun,
  resumeRun,
  uncertainActions,
  prepareRun,
  answerInput,
} from "./engine";
import { capabilities, generate, dataDir } from "./providers";
import { initialize, saveJson, listJson, readJson } from "./storage";
const app = express();
const port = Number(process.env.PORT || 4317);
const origins = new Set([
  `http://127.0.0.1:${port}`,
  `http://localhost:${port}`,
  "http://127.0.0.1:5173",
  "http://localhost:5173",
]);
app.use((req, res, next) => {
  if (
    !["127.0.0.1", "localhost"].includes(req.hostname) ||
    (req.headers.origin && !origins.has(req.headers.origin))
  ) {
    res
      .status(403)
      .json({ error: "This workspace only accepts local requests." });
    return;
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});
app.use(express.json({ limit: "32mb" }));
await loadConnections();
await loadIntegrations();
app.get("/api/integrations", (_req, res) => res.json(integrationStatus()));
app.put("/api/integrations", async (req, res) =>
  res.json(await saveIntegrations(req.body)),
);
app.post("/api/browser/open", async (req, res) => {
  const body = z
    .object({ workflowId: idSchema, nodeId: idSchema })
    .parse(req.body);
  const workflow = workflowSchema.parse(
    await readJson("workflows", body.workflowId),
  );
  const node = workflow.nodes.find(
    (n) => n.id === body.nodeId && n.data.kind === "browser",
  );
  if (!node)
    throw new Error("Browser task not found. Save the workflow first.");
  await openWorkflowBrowser(
    `${workflow.id}-${node.id}`,
    interpolate(node.data.url, { input: JSON.parse(workflow.input) }),
  );
  res.json({ opened: true });
});
app.get("/api/browser/logins", (_req, res) => res.json(currentLogins()));
app.post("/api/browser/logins", async (req, res) => {
  const body = z
    .object({
      workflowId: idSchema,
      nodeId: idSchema,
      input: z.unknown().optional(),
    })
    .parse(req.body);
  const workflow = workflowSchema.parse(
    await readJson("workflows", body.workflowId),
  );
  if ([...active.values()].some(({ run }) => run.workflowId === workflow.id))
    throw new Error(
      "Wait for the workflow to stop before starting sign-in assistance.",
    );
  const node = workflow.nodes.find(
    (n) => n.id === body.nodeId && n.data.kind === "browser",
  );
  if (!node) throw new Error("Browser step not found.");
  const skills = await resolveSkills([
    ...new Set([...workflow.skillIds, ...node.data.skillIds]),
  ]);
  res
    .status(202)
    .json(
      startLogin(
        workflow,
        body.nodeId,
        body.input ?? JSON.parse(workflow.input),
        skills,
      ),
    );
});
app.get("/api/browser/logins/:id", (req, res) =>
  res.json(loginStatus(req.params.id)),
);
app.post("/api/browser/logins/:id/finish", async (req, res) =>
  res.json(await finishLogin(req.params.id)),
);
app.post("/api/browser/logins/:id/focus", async (req, res) =>
  res.json(await focusLogin(req.params.id)),
);
app.post("/api/browser/logins/:id/cancel", async (req, res) =>
  res.json(await finishLogin(req.params.id, true)),
);
const active = new Map<string, { run: Run; controller: AbortController }>();
async function launchRun(run: Run, input: unknown) {
  if (currentLogins().some((session) => session.workflowId === run.workflowId))
    throw new Error(
      "Finish or cancel browser sign-in assistance before running this workflow.",
    );
  if (active.size >= 4)
    throw new Error("Four runs are already active. Wait or cancel one.");
  const controller = new AbortController();
  run.input = input;
  active.set(run.id, { run, controller });
  try {
    await prepareRun(run);
    await saveJson("runs", run.id, run);
  } catch (error) {
    active.delete(run.id);
    throw error;
  }
  void executeRun(run, input, controller.signal)
    .catch((error) => console.error("Run persistence failed:", error))
    .finally(() => active.delete(run.id));
  return run;
}
const scheduler = new Scheduler(
  async (s, id, scheduledAt) => {
    const run = createRun(s.workflow, s.mode, id);
    run.scheduleId = s.id;
    run.scheduledAt = scheduledAt;
    run.workflowSnapshots = structuredClone(s.workflowSnapshots);
    await launchRun(run, JSON.parse(s.input));
  },
  (workflowId) =>
    [...active.values()].some((t) => t.run.workflowId === workflowId),
  () => active.size < 4,
);
app.get("/api/schedules", async (_req, res) => {
  const items = await scheduler.list();
  res.json(
    await Promise.all(
      items.map(async (s) => {
        let lastRunStatus: string | undefined;
        if (s.lastRunId) {
          try {
            lastRunStatus = (
              active.get(s.lastRunId)?.run ||
              (await readJson<Run>("runs", s.lastRunId))
            ).status;
          } catch {}
        }
        return { ...s, lastRunStatus };
      }),
    ),
  );
});
app.post("/api/schedules/preview", (req, res) =>
  res.json({ times: previewOccurrences(req.body) }),
);
app.post("/api/schedules", async (req, res) =>
  res.status(201).json(await scheduler.save(req.body)),
);
app.put("/api/schedules/:id", async (req, res) =>
  res.json(await scheduler.save(req.body, req.params.id)),
);
app.patch("/api/schedules/:id", async (req, res) =>
  res.json(
    await scheduler.toggle(
      req.params.id,
      z.object({ enabled: z.boolean() }).parse(req.body).enabled,
    ),
  ),
);
app.delete("/api/schedules/:id", async (req, res) => {
  await scheduler.remove(req.params.id);
  res.json({ deleted: true });
});
app.get("/api/skills", async (_req, res) => res.json(await installedSkills()));
app.get("/api/marketplace", async (req, res) =>
  res.json(await catalog(z.string().parse(req.query.repo || "openai/skills"))),
);
app.post("/api/skills/preview", async (req, res) =>
  res.json(await previewSkill(req.body)),
);
app.post("/api/skills/install", async (req, res) =>
  res.status(201).json(await installSkill(req.body)),
);
app.delete("/api/skills/:id", async (req, res) => {
  await removeSkill(req.params.id);
  res.json({ deleted: true });
});

app.get("/api/workflow-marketplace", async (req, res) =>
  res.json(
    await workflowCatalog(
      typeof req.query.repo === "string" ? req.query.repo : undefined,
    ),
  ),
);
app.post("/api/workflow-marketplace/preview", async (req, res) => {
  const p = await marketplacePackage(req.body);
  res.json({
    package: p,
    requirements: requirements(p.workflows),
    findings: secretFindings(p),
  });
});
app.post("/api/packages/preview", async (req, res) =>
  res.json(await previewPackage(req.body)),
);
app.post("/api/packages/inspect", async (req, res) => {
  const p = validatePackage(req.body);
  res.json({
    package: p,
    requirements: requirements(p.workflows),
    findings: secretFindings(p),
  });
});
app.post("/api/packages/import", async (req, res) =>
  res.status(201).json(await importPackage(req.body)),
);
app.post("/api/packages/export", async (req, res) => {
  const kind = z
    .enum(["skill", "workflow", "contribution"])
    .parse(req.query.kind);
  const p = validatePackage(req.body),
    slug = slugify(p.name);
  if (secretFindings(p).length) {
    res
      .status(400)
      .json({ error: "Remove detected embedded credentials before sharing." });
    return;
  }
  const json = JSON.stringify(p, null, 2);
  if (kind === "workflow") {
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${slug}.jeeves.json"`,
    );
    res.type("json").send(json);
    return;
  }
  let bytes: Uint8Array;
  if (kind === "skill") bytes = await skillArchive(p);
  else {
    if (p.license === "Private") {
      res
        .status(400)
        .json({ error: "Choose a redistribution license for a contribution." });
      return;
    }
    const entry = {
      id: slug,
      name: p.name,
      description: p.description,
      author: p.author,
      license: p.license,
      tags: p.tags,
      path: `workflows/${slug}.json`,
      sha256: createHash("sha256").update(json).digest("hex"),
      nodeCount: Object.values(p.workflows).reduce(
        (n, w) => n + w.nodes.length,
        0,
      ),
      providers: requirements(p.workflows).providers,
    };
    bytes = zipSync(
      {
        [`workflows/${slug}.json`]: strToU8(json),
        "manifest-entry.json": strToU8(JSON.stringify(entry, null, 2)),
        "jeeves-marketplace.json": strToU8(
          JSON.stringify({ version: 1, workflows: [entry] }, null, 2),
        ),
        "CONTRIBUTING.md": strToU8(
          `# Contribute ${p.name}\n\nReview workflow prompts, example input, URLs, and bundled skill licenses before sharing. This archive contains no Jeeves account, provider settings, or run history.\n\nFor an existing community repository, copy workflows/${slug}.json and append manifest-entry.json to the workflows array in its jeeves-marketplace.json. Do not replace an existing index.\n\nFor your own new public repository, use the included jeeves-marketplace.json as the root catalog. Others can connect owner/repository from Explore in Jeeves.\n\nSend this archive to the maintainer by a channel you already use, or submit the files in a pull request. Jeeves does not require a login or upload anything automatically. GitHub itself requires its own account to publish there.\n\nDeclared workflow license: ${p.license}. Bundled skills retain their own licenses.\n`,
        ),
      },
      { level: 6 },
    );
  }
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${slug}${kind === "contribution" ? "-contribution" : "-skill"}.zip"`,
  );
  res.type("application/zip").send(Buffer.from(bytes));
});
app.get("/api/chats", async (_req, res) =>
  res.json(
    (await listJson<ChatSession>("chats"))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(({ plan, messages, ...s }) => ({
        ...s,
        messageCount: messages.length,
      })),
  ),
);
app.get("/api/chats/:id", async (req, res) => {
  const s = await readChat(req.params.id);
  if (s.plan) s.plan.requirements = requirements(s.plan.workflowSnapshots);
  res.json(s);
});
app.delete("/api/chats/:id", async (req, res) => {
  await chatLock(req.params.id, () => deleteChat(req.params.id));
  res.json({ deleted: true });
});
app.post("/api/chat", async (req, res) => {
  const body = chatInput.parse(req.body),
    controller = new AbortController();
  req.on("aborted", () => controller.abort());
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });
  res.json(
    await chatLock(body.id, () =>
      planChat(
        body,
        AbortSignal.any([controller.signal, AbortSignal.timeout(180000)]),
      ),
    ),
  );
});
app.post("/api/chats/:id/connection", async (req, res) => {
  idSchema.parse(req.params.id);
  res.json(
    await chatLock(req.params.id, () =>
      applyChatConnection(req.params.id, req.body),
    ),
  );
});
app.post("/api/chats/:id/run", async (req, res) => {
  idSchema.parse(req.params.id);
  const body = z
    .object({
      revision: z.string(),
      input: z.unknown(),
      mode: z.enum(["demo", "live"]),
    })
    .parse(req.body);
  const run = await chatLock(req.params.id, async () => {
    const session = await readChat(req.params.id);
    const existing = session.executions?.[body.revision];
    if (existing)
      return (
        active.get(existing)?.run || (await readJson<Run>("runs", existing))
      );
    if (!session.plan || session.revision !== body.revision)
      throw new Error(
        "This proposal changed. Review the latest plan before running.",
      );
    const run = createRun(session.plan.workflow, body.mode, randomUUID());
    run.workflowSnapshots = session.plan.workflowSnapshots;
    session.plan.input = body.input;
    session.executions = { ...session.executions, [body.revision]: run.id };
    session.runIds.push(run.id);
    session.updatedAt = new Date().toISOString();
    await saveJson("chats", session.id, session);
    try {
      await launchRun(run, body.input);
    } catch (e) {
      delete session.executions[body.revision];
      session.runIds = session.runIds.filter((id) => id !== run.id);
      await saveJson("chats", session.id, session);
      throw e;
    }
    return run;
  });
  res.status(201).json(run);
});
app.get("/api/status", (_req, res) =>
  res.json({ providers: capabilities(), version: packageMetadata.version }),
);
app.put("/api/connections", async (req, res) =>
  res.json({ providers: await saveConnection(req.body) }),
);
app.post("/api/connections/:provider/check", async (req, res) =>
  res.json(
    await checkConnection(connectionProvider.parse(req.params.provider)),
  ),
);
// Waiting requests are durable and discoverable independently of the open editor.
app.get("/api/input-requests", async (_req, res) => {
  res.json(
    (await listJson<Run>("runs")).filter((run) => run.status === "waiting"),
  );
});
const answering = new Set<string>();
app.post("/api/runs/:id/input/:nodeId", async (req, res) => {
  const id = idSchema.parse(req.params.id),
    nodeId = idSchema.parse(req.params.nodeId);
  const body = z
    .object({
      requestId: z.string().min(1).max(100),
      answers: z.record(z.string(), z.unknown()),
    })
    .parse(req.body);
  if (answering.has(id) || active.has(id)) {
    res.status(409).json({
      error: "This run is already continuing. Refresh to see its progress.",
    });
    return;
  }
  answering.add(id);
  try {
    const previous = await readJson<Run>("runs", id);
    const run = structuredClone(previous);
    let result;
    try {
      result = answerInput(run, nodeId, body.requestId, body.answers);
    } catch (e) {
      res.status(409).json({ error: (e as Error).message });
      return;
    }
    if (Object.keys(result.errors).length) {
      res.status(400).json({
        error: "Check the highlighted answers.",
        fieldErrors: result.errors,
      });
      return;
    }
    if (
      run.workflow.nodes.find((n) => n.id === nodeId)?.data.kind === "browser"
    ) {
      const url = await finishManualBrowser(`${run.workflowId}-${nodeId}`);
      if (url && run.nodes[nodeId].status === "pending") {
        run.nodes[nodeId].output = {
          ...(run.nodes[nodeId].output as Record<string, unknown>),
          url,
        };
      }
    }
    if (Object.values(run.nodes).some((n) => n.status === "waiting")) {
      await saveJson("runs", run.id, run);
    } else {
      run.status = "running";
      delete run.finishedAt;
      await launchRun(run, run.input);
    }
    res.json(run);
  } finally {
    answering.delete(id);
  }
});
app.post("/api/runs/:id/resume", async (req, res) => {
  if (active.size >= 4) {
    res.status(429).json({ error: "Four runs are already active." });
    return;
  }
  const previous =
    active.get(req.params.id)?.run ||
    (await readJson<Run>("runs", req.params.id));
  if (!["failed", "cancelled"].includes(previous.status)) {
    res
      .status(409)
      .json({ error: "Only stopped or failed runs can be resumed." });
    return;
  }
  if (active.size >= 4) {
    res.status(429).json({ error: "Four runs are already active." });
    return;
  }
  if (
    [...active.values()].some((task) => task.run.resumedFrom === previous.id)
  ) {
    res
      .status(409)
      .json({ error: "This checkpoint is already being resumed." });
    return;
  }
  const hazards = uncertainActions(previous);
  if (hazards.length && req.body?.confirmActions !== true) {
    res.status(409).json({
      error: `These external actions may already have changed their destination: ${hazards.join(", ")}. Check the destination before retrying.`,
      requiresActionConfirmation: true,
    });
    return;
  }
  const run = resumeRun(previous, randomUUID());
  await launchRun(run, run.input);
  res.status(201).json(run);
});
app.get("/api/workflows", async (_req, res) =>
  res.json(
    (await listJson<Workflow>("workflows")).map((w) => workflowSchema.parse(w)),
  ),
);
app.put("/api/workflows/:id", async (req, res) => {
  const workflow = workflowSchema.parse(req.body);
  if (workflow.id !== req.params.id) {
    res.status(400).json({ error: "Workflow ID mismatch." });
    return;
  }
  await saveJson("workflows", workflow.id, workflow);
  res.json(workflow);
});
app.post("/api/validate", (req, res) =>
  res.json({ errors: validateGraph(workflowSchema.parse(req.body)) }),
);
app.post("/api/runs", async (req, res) => {
  const body = z
    .object({
      workflow: workflowSchema,
      mode: z.enum(["demo", "live"]),
      input: z.unknown(),
      concurrency: z.number().int().min(1).max(8).default(3),
    })
    .parse(req.body);
  const errors = validateGraph(body.workflow);
  if (errors.length) {
    res.status(400).json({ error: errors.join(" ") });
    return;
  }
  if (active.size >= 4) {
    res
      .status(429)
      .json({ error: "Four runs are already active. Wait or cancel one." });
    return;
  }
  const run = createRun(body.workflow, body.mode, randomUUID());
  run.concurrency = body.concurrency;
  await launchRun(run, body.input);
  res.status(201).json(run);
});
app.get("/api/runs", async (_req, res) =>
  res.json(
    (await listJson<Run>("runs"))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .map(
        ({ workflow, workflowSnapshots, nodes, skillSnapshots, ...run }) => ({
          ...run,
          nodes,
        }),
      ),
  ),
);
app.get("/api/runs/:id", async (req, res) =>
  res.json(
    active.get(req.params.id)?.run ||
      (await readJson<Run>("runs", req.params.id)),
  ),
);
app.post("/api/runs/:id/browser/:nodeId/open", async (req, res) => {
  const run =
    active.get(idSchema.parse(req.params.id))?.run ||
    (await readJson<Run>("runs", req.params.id));
  const node = run.workflow.nodes.find(
    (n) =>
      n.id === idSchema.parse(req.params.nodeId) && n.data.kind === "browser",
  );
  if (!node || run.mode !== "live" || !run.nodes[node.id]?.startedAt)
    throw new Error("This run has no saved browser session for that step.");
  if (run.status === "running") {
    res
      .status(409)
      .json({ error: "Stop the run before opening its browser session." });
    return;
  }
  const state = run.nodes[node.id];
  const output = state.output as { url?: unknown } | undefined;
  const url =
    typeof output?.url === "string"
      ? output.url
      : state.browserUrl || interpolate(node.data.url, { input: run.input });
  await openWorkflowBrowser(`${run.workflowId}-${node.id}`, url);
  res.json({ opened: true });
});
app.post("/api/runs/:id/cancel", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  if (answering.has(id)) {
    res.status(409).json({
      error: "Your answers are being saved. Try stopping again in a moment.",
    });
    return;
  }
  const task = active.get(id);
  if (task) {
    task.controller.abort();
    res.json({ cancelled: true });
    return;
  }
  answering.add(id);
  try {
    const run = await readJson<Run>("runs", id);
    if (run.status !== "waiting") {
      res.json({ cancelled: false });
      return;
    }
    run.status = "cancelled";
    run.finishedAt = new Date().toISOString();
    for (const state of Object.values(run.nodes))
      if (["waiting", "pending"].includes(state.status))
        state.status = "cancelled";
    run.events.push({
      time: run.finishedAt,
      message: "Run stopped while waiting for input.",
    });
    await saveJson("runs", id, run);
    res.json({ cancelled: true });
  } finally {
    answering.delete(id);
  }
});
app.get("/api/artifacts/:name", (req, res) => {
  if (!/^[a-zA-Z0-9_-]+\.(md|png)$/.test(req.params.name)) {
    res.status(400).json({ error: "Invalid artifact name." });
    return;
  }
  res.download(path.join(dataDir, "artifacts", req.params.name));
});
app.post("/api/copilot", async (req, res) => {
  const controller = new AbortController();
  req.on("aborted", () => controller.abort());
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });
  const body = z
    .object({
      message: z.string().min(1).max(10000),
      workflow: workflowSchema,
      mode: z.enum(["demo", "live"]),
      provider: providerSchema.default("openai"),
      model: z.string().max(120).default(""),
    })
    .parse(req.body);
  if (body.mode === "demo") {
    const template = /review|draft|writ/i.test(body.message) ? review : starter;
    res.json({
      message: `I prepared the “${template.name}” starter for you. In demo mode I select from local templates; switch to Live for a model-generated workflow. Review the proposal, then apply it to the canvas.`,
      workflow: { ...template, id: body.workflow.id, name: template.name },
    });
    return;
  }
  const instructions = `You are Jeeves, a workflow design assistant. Return ONLY a JSON object with "message" (brief explanation) and "workflow" (the FULL updated workflow). Preserve the current workflow id. Use this JSON Schema: ${JSON.stringify(z.toJSONSchema(workflowSchema))}. Workflow kinds: input, user-input, agent, browser, handoff, decision, action, workflow, output. Use user-input to ask the user for missing details or a choice during execution. Configure inputFields with key, label, type (text/longtext/list/number/boolean/choice), required, help, options, min/max and optional format us_zip. The run pauses durably; submitted answers become that node output for downstream context.parents and context.previous. Do not ask for passwords, payment details or MFA in these forms; use browser sign-in. Place input requests in the root workflow, not nested workflows. Browser nodes use url, prompt, provider, browserMode observe/interact and browserSteps. They control a separate Google Chrome session; recommend manual review before purchases or publishing. HTTP action URL and JSON string values support {{input.field}} placeholders; authEnv is a named Bearer credential stored separately in Settings. Never invent real credentials. Exactly one input. DAG only. Every node must be reachable from input. Include output. Jev decision nodes use decisionEngine jev, with questionType noul/choice/score, question instructions, and JSON-encoded criteria. Noul routes pass/fail/review by probability thresholds, Choice routes to named criteria keys or review if confidence is low, Score routes pass/fail/review by score and confidence. Connect EVERY decision route, including review. Choice keys may not be review. Deterministic rules use decisionEngine rule with pass/fail ports. Decision edge sourceHandle must match a route. Other edges have no sourceHandle. Position nodes left to right at least 310px apart. Each agent has a narrow task. Handoffs carry context. Avoid HTTP actions unless explicitly requested. Never insert credentials. Do not invent saved workflow IDs. Configured agent providers: ${JSON.stringify(
    Object.entries(capabilities())
      .filter(
        ([key, value]) =>
          ["openai", "openrouter", "local", "codex"].includes(key) &&
          value === true,
      )
      .map(([key]) => key),
  )}. Keep new agent nodes on configured providers unless the user explicitly asks otherwise. Default provider ${body.provider}; model ${body.model || "(use empty string for server default)"}. Only assign skillIds from this installed skill catalog: ${JSON.stringify(await installedSkills())}. Preserve existing skill assignments unless the user asks to change them. Existing workflow: ${JSON.stringify(body.workflow)}`;
  const output = await generate(
    body.provider,
    body.model,
    instructions +
      " When insufficient information is a meaningful outcome, include an explicit named Choice option such as needs_information connected to a clarification specialist. Confidence measures certainty in a selected option; do not rely on low confidence alone to detect missing facts. Keep the separate review route for low-confidence decisions.",
    body.message,
    AbortSignal.any([controller.signal, AbortSignal.timeout(120000)]),
    `copilot-${randomUUID()}`,
    await resolveSkills(body.workflow.skillIds || []),
  );
  const clean = output
    .trim()
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "");
  const result = z
    .object({ message: z.string(), workflow: workflowSchema })
    .parse(JSON.parse(clean));
  result.workflow.id = body.workflow.id;
  const errors = validateGraph(result.workflow);
  if (errors.length)
    throw new Error(`Copilot returned an invalid graph: ${errors.join(" ")}`);
  res.json(result);
});
const dist = path.resolve("dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.join(dist, "index.html")),
  );
}
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const err = error as { code?: string; message?: string };
    res
      .status(
        error instanceof z.ZodError ? 400 : err.code === "ENOENT" ? 404 : 500,
      )
      .json({
        error:
          error instanceof z.ZodError
            ? error.issues
                .map((i) => `${i.path.join(".")}: ${i.message}`)
                .join("; ")
            : err.message || "Unexpected server error.",
      });
  },
);
await initialize();
const server = app.listen(port, "127.0.0.1", () =>
  console.log(`Jeeves API ready at http://127.0.0.1:${port}`),
);
scheduler.start();
const shutdown = () => {
  scheduler.stop();
  for (const task of active.values()) task.controller.abort();
  server.close();
  setTimeout(() => process.exit(0), 1500).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
