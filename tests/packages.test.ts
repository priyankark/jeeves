import { describe, it, expect, vi, afterEach } from "vitest";
import {
  mkdtemp,
  writeFile,
  readFile,
  mkdir,
  readdir,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { unzipSync, strFromU8 } from "fflate";
import {
  previewPackage,
  validatePackage,
  importPackage,
  secretFindings,
  skillArchive,
} from "../server/packages";
import { blank, starter } from "../shared/templates";
import { makeNode } from "../shared/schema";
import { saveJson, readJson } from "../server/storage";
import { matchWorkflows, planChat } from "../server/chat";
import { randomUUID } from "node:crypto";
import { groceryCart } from "../shared/templates";
import { simulationServer } from "./fixtures/simulation-server";
const exec = promisify(execFile);
const temporaryExports: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporaryExports
      .splice(0)
      .map((dir) => rm(dir, { recursive: true, force: true })),
  );
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe("portable workflows and home chat", () => {
  it("exported browser skill runs live with its bundled browser driver and no npm install", async () => {
    const fixture = await simulationServer();
    try {
      const workflow = structuredClone(groceryCart);
      const browser = workflow.nodes.find((n) => n.data.kind === "browser")!;
      browser.data.url = fixture.origin + "/shop";
      browser.data.provider = "local";
      browser.data.model = "fixture-model";
      const p = (await previewPackage({ workflow, includeInput: true }))
        .package;
      const files = unzipSync(await skillArchive(p));
      const root = await mkdtemp(path.join(tmpdir(), "jeeves-browser-export-"));
      temporaryExports.push(root);
      for (const [name, data] of Object.entries(files)) {
        const file = path.join(root, name);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, data);
      }
      const slug = Object.keys(files)[0].split("/")[0];
      expect(
        files[`${slug}/scripts/node_modules/playwright-core/package.json`],
      ).toBeDefined();
      const result = await exec(
        process.execPath,
        [
          path.join(root, slug, "scripts/run.cjs"),
          "--mode",
          "live",
          "--output",
          path.join(root, "results"),
        ],
        {
          cwd: root,
          env: {
            ...process.env,
            LOCAL_MODEL: "fixture-model",
            LOCAL_BASE_URL: fixture.origin + "/v1",
            LOCAL_API_KEY: "",
            ACTION_ALLOWED_ORIGINS: fixture.origin,
          },
          timeout: 30000,
        },
      );
      const waiting = JSON.parse(result.stdout);
      expect(waiting.status).toBe("waiting");
      expect(waiting.inputRequests[0].nodeId).toBe("shopping-details");
      expect(fixture.events.filter((e) => e.path === "/cart")).toHaveLength(0);
      const answers = path.join(root, "answers.json");
      await writeFile(
        answers,
        JSON.stringify({
          "shopping-details": {
            grocery_list: ["1 carton oat milk"],
            budget_usd: 15,
            delivery_zip: "02139",
            dietary_constraints: ["No nut products"],
            substitutions: false,
          },
        }),
      );
      const continued = await exec(
        process.execPath,
        [
          path.join(root, slug, "scripts/run.cjs"),
          "--resume",
          waiting.checkpoint,
          "--answers",
          answers,
          "--output",
          path.join(root, "results"),
        ],
        {
          cwd: root,
          env: {
            ...process.env,
            LOCAL_MODEL: "fixture-model",
            LOCAL_BASE_URL: fixture.origin + "/v1",
            LOCAL_API_KEY: "",
            ACTION_ALLOWED_ORIGINS: fixture.origin,
          },
          timeout: 30000,
        },
      );
      const report = JSON.parse(continued.stdout);
      expect(report.runId).toBe(waiting.runId);
      expect(report.status).toBe("waiting");
      expect(report.inputRequests[0].nodeId).toBe(browser.id);
      expect(report.inputRequests[0].message).toContain("$4.00");
      expect(report.inputRequests[0].fields[0].options).toContain(
        "Accept result and finish this step",
      );
      await writeFile(
        answers,
        JSON.stringify({
          [browser.id]: { action: "Accept result and finish this step" },
        }),
      );
      const accepted = await exec(
        process.execPath,
        [
          path.join(root, slug, "scripts/run.cjs"),
          "--resume",
          report.checkpoint,
          "--answers",
          answers,
          "--output",
          path.join(root, "results"),
        ],
        {
          cwd: root,
          env: {
            ...process.env,
            LOCAL_MODEL: "fixture-model",
            LOCAL_BASE_URL: fixture.origin + "/v1",
            LOCAL_API_KEY: "",
            ACTION_ALLOWED_ORIGINS: fixture.origin,
          },
          timeout: 30000,
        },
      );
      const finished = JSON.parse(accepted.stdout);
      expect(finished.status).toBe("completed");
      expect(finished.runId).toBe(waiting.runId);
      expect(finished.results.output.summary).toContain("$4.00");
      expect(finished.results.output.reviewedByUser).toBe(true);
      expect(fixture.events.filter((e) => e.path === "/cart")).toHaveLength(1);
      expect(fixture.events.filter((e) => e.path === "/purchase")).toHaveLength(
        0,
      );
    } finally {
      await fixture.close();
    }
  }, 30000);
  it("redacts saved input by default and never includes provider credentials", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-fixture-private-credential-123456789");
    const p = await previewPackage({
      workflow: { ...blank, input: '{"task":"PRIVATE CUSTOMER DATA"}' },
    });
    expect(JSON.stringify(p.package)).not.toContain("PRIVATE CUSTOMER DATA");
    expect(JSON.stringify(p.package)).not.toContain(process.env.OPENAI_API_KEY);
    const leaked = structuredClone(p.package);
    leaked.workflows[blank.id].description =
      "Authorization: Bearer fixture-private-credential-123456789";
    expect(secretFindings(leaked)).toContain(
      `workflows.${blank.id}.description`,
    );
    await expect(skillArchive(leaked)).rejects.toThrow("credentials");
  });
  it("imports a complete nested graph with fresh IDs without overwriting saved work", async () => {
    const child = { ...blank, id: "package-child" };
    await saveJson("workflows", child.id, child);
    const parent = {
      ...blank,
      id: "package-parent",
      nodes: [
        blank.nodes[0],
        makeNode("workflow", "nested", 1, 1, { workflowId: child.id }),
        blank.nodes[1],
      ],
      edges: [
        { id: "a", source: "input", target: "nested" },
        { id: "b", source: "nested", target: "output" },
      ],
    };
    const { package: p } = await previewPackage({ workflow: parent });
    const imported = await importPackage(p);
    expect(imported.id).not.toBe(parent.id);
    const childId = imported.nodes[1].data.workflowId;
    expect(childId).not.toBe(child.id);
    expect(await readJson("workflows", childId)).toMatchObject({ id: childId });
    expect(await readJson("workflows", child.id)).toMatchObject(child);
    const broken = structuredClone(p);
    delete broken.workflows[child.id];
    expect(() => validatePackage(broken)).toThrow("Missing nested");
  });
  it("executes an exported skill in a separate directory without node_modules or Jeeves", async () => {
    const { package: p } = await previewPackage({ workflow: starter });
    const zip = await skillArchive(p),
      files = unzipSync(zip);
    const root = await mkdtemp(path.join(tmpdir(), "jeeves-portable-"));
    temporaryExports.push(root);
    for (const [name, data] of Object.entries(files)) {
      const file = path.join(root, name);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, data);
    }
    const slug = Object.keys(files)[0].split("/")[0];
    const runner = path.join(root, slug, "scripts/run.cjs");
    const env = {
      ...process.env,
      OPENAI_API_KEY: "",
      OPENROUTER_API_KEY: "",
      TYPESAFE_API_KEY: "",
      ENABLE_CODEX: "false",
    };
    const result = await exec(
      process.execPath,
      [
        runner,
        "--mode",
        "demo",
        "--json",
        '{"task":"Portable fixture","demo_jev_value":0.5}',
        "--output",
        path.join(root, "results"),
      ],
      { cwd: root, env },
    );
    const report = JSON.parse(result.stdout);
    expect(report.status).toBe("completed");
    const run = JSON.parse(await readFile(report.checkpoint, "utf8"));
    expect(run.nodes.gate.output.route).toBe("review");
    expect(run.nodes.reviewer.status).toBe("completed");
    expect(
      (await readdir(path.join(root, "results/artifacts"))).length,
    ).toBeGreaterThan(0);
    expect(strFromU8(files[`${slug}/SKILL.md`])).toContain("scripts/run.cjs");
    await expect(
      exec(process.execPath, [runner, "--check"], { cwd: root, env }),
    ).rejects.toMatchObject({ code: 2 });
  });
  it("matches workflows locally and prepares a plan without executing or calling a model", async () => {
    await saveJson("workflows", starter.id, starter);
    const fetch = vi.spyOn(globalThis, "fetch");
    expect(
      matchWorkflows("Run Research to brief for my team", [starter, blank])[0]
        .workflow.id,
    ).toBe(starter.id);
    const chat = await planChat(
      {
        id: randomUUID(),
        message: "Research to brief about test fixtures",
        mode: "demo",
      },
      new AbortController().signal,
    );
    expect(chat.plan?.workflow.id).toBe(starter.id);
    expect(chat.plan?.input).toMatchObject({
      task: "Research to brief about test fixtures",
    });
    expect(chat.runIds).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
    expect(
      (await readJson<{ messages: unknown[] }>("chats", chat.id)).messages,
    ).toHaveLength(2);
  });
  it("rejects unsupported paths in bundled resources", async () => {
    const p = (await previewPackage({ workflow: blank })).package;
    p.skills = [
      {
        id: "x",
        name: "fixture",
        description: "fixture",
        repo: "example/skills",
        path: "fixture",
        commit: "a".repeat(40),
        installedAt: "",
        fileCount: 2,
        hasScripts: false,
        files: {
          "SKILL.md": Buffer.from(
            "---\nname: fixture\ndescription: test\n---\nTest",
          ).toString("base64"),
          "../outside": Buffer.from("bad").toString("base64"),
        },
      },
    ];
    expect(() => validatePackage(p)).toThrow("Invalid skill file path");
  });
});

describe("community catalogs", () => {
  it("pins the repository revision and verifies the workflow checksum before import", async () => {
    const { workflowCatalog, marketplacePackage } =
      await import("../server/workflow-market");
    const { createHash } = await import("node:crypto");
    const p = (await previewPackage({ workflow: blank })).package;
    const json = JSON.stringify(p),
      commit = "c".repeat(40),
      repo = `fixture/community-${randomUUID()}`;
    const entry = {
      id: "fixture",
      name: p.name,
      description: p.description,
      license: "MIT",
      path: "workflows/fixture.json",
      sha256: createHash("sha256").update(json).digest("hex"),
    };
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const u = String(url);
      if (u.endsWith("commits/HEAD")) return Response.json({ sha: commit });
      if (u.endsWith("jeeves-marketplace.json"))
        return Response.json({ version: 1, workflows: [entry] });
      return new Response(json);
    });
    const c = await workflowCatalog(repo);
    expect(c.listings[0].commit).toBe(commit);
    expect(
      (await marketplacePackage({ id: "fixture", repo, commit })).rootId,
    ).toBe(blank.id);
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(json + "tampered"),
    );
    await expect(
      marketplacePackage({ id: "fixture", repo, commit }),
    ).rejects.toThrow("checksum");
  });
});

it("concurrent imports allocate distinct names without replacing existing workflows", async () => {
  const workflow = {
    ...blank,
    id: randomUUID(),
    name: `Distinct ${randomUUID()}`,
  };
  await saveJson("workflows", workflow.id, workflow);
  const p = (await previewPackage({ workflow, includeInput: true })).package;
  const copies = await Promise.all([importPackage(p), importPackage(p)]);
  expect(new Set(copies.map((w) => w.id)).size).toBe(2);
  expect(copies.map((w) => w.name)).toEqual([
    `${workflow.name} · copy 2`,
    `${workflow.name} · copy 3`,
  ]);
  expect((await readJson<any>("workflows", workflow.id)).name).toBe(
    workflow.name,
  );
});

it("keeps imported copy names within the workflow schema limit", async () => {
  const workflow = {
    ...blank,
    id: randomUUID(),
    name: "Long workflow ".repeat(8).slice(0, 100),
  };
  await saveJson("workflows", workflow.id, workflow);
  const p = (await previewPackage({ workflow, includeInput: true })).package;
  const copy = await importPackage(p);
  expect(copy.name).toHaveLength(100);
  expect(copy.name).toMatch(/ · copy 2$/);
  expect(() =>
    validatePackage({ ...p, rootId: copy.id, workflows: { [copy.id]: copy } }),
  ).not.toThrow();
});
