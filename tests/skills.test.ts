import { describe, it, expect, vi, afterEach } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  catalog,
  previewSkill,
  installSkill,
  installedSkills,
  removeSkill,
  skillInstructions,
  skillMetadata,
  safeSkillPath,
  resolveSkills,
} from "../server/skills";
import { generate, dataDir } from "../server/providers";
import { createRun, executeRun, resumeRun, prepareRun } from "../server/engine";
import { blank } from "../shared/templates";
import { makeNode } from "../shared/schema";
import { saveJson } from "../server/storage";
import type { SkillBundle } from "../shared/automation";
const content =
  "---\nname: concise-review\ndescription: Write a precise review.\n---\nAlways report FINDING, EVIDENCE, NEXT STEP. Read references/checklist.md.";
const bundle: SkillBundle = {
  id: "test-skill",
  name: "concise-review",
  description: "Precise review",
  repo: "example/skills",
  path: "skills/concise-review",
  commit: "a".repeat(40),
  installedAt: new Date().toISOString(),
  fileCount: 2,
  hasScripts: false,
  files: {
    "SKILL.md": Buffer.from(content).toString("base64"),
    "references/checklist.md": Buffer.from(
      "Cite observed facts, not invented evidence.",
    ).toString("base64"),
  },
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe("skill marketplace and harness integration", () => {
  it("validates metadata and blocks traversal", () => {
    expect(skillMetadata(content).name).toBe("concise-review");
    for (const file of [
      "../secret",
      "/etc/passwd",
      "a/../../b",
      "a\\b",
      ".git/config",
      "a\0b",
    ])
      expect(() => safeSkillPath(file)).toThrow();
    expect(() => skillMetadata("No frontmatter")).toThrow();
  });
  it("browses, previews and installs an immutable GitHub revision without executing files", async () => {
    const repo = `fixtures/skills-${randomUUID()}`;
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url) => {
        const u = String(url);
        if (u.includes("commits/HEAD"))
          return Response.json({ sha: bundle.commit });
        if (u.includes("git/trees"))
          return Response.json({
            tree: [
              {
                path: "skills/concise-review/SKILL.md",
                type: "blob",
                mode: "100644",
                size: content.length,
              },
              {
                path: "skills/concise-review/references/checklist.md",
                type: "blob",
                mode: "100644",
                size: 30,
              },
            ],
          });
        return new Response(
          u.endsWith("SKILL.md") ? content : "Check real evidence.",
        );
      });
    expect((await catalog(repo)).skills[0].name).toBe("concise-review");
    const preview = await previewSkill({ repo, path: bundle.path });
    expect(preview.instructions).toContain("FINDING");
    const installed = await installSkill({
      repo,
      path: bundle.path,
      commit: preview.commit,
    });
    expect((await installedSkills()).some((s) => s.id === installed.id)).toBe(
      true,
    );
    expect(
      fetcher.mock.calls
        .filter(([url]) => String(url).includes("raw.githubusercontent.com"))
        .every(([url]) => String(url).includes(bundle.commit)),
    ).toBe(true);
    const snapshot = await resolveSkills([installed.id, installed.id]);
    expect(snapshot).toHaveLength(1);
    await removeSkill(installed.id);
    expect(await skillInstructions(snapshot)).toContain("Check real evidence.");
    await expect(resolveSkills([installed.id])).rejects.toThrow("missing");
  });
  it("rejects symlinks before downloading a skill", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        tree: [{ path: "SKILL.md", type: "blob", mode: "120000", size: 10 }],
      }),
    );
    await expect(
      previewSkill({ repo: "fixtures/symlink", commit: bundle.commit }),
    ).rejects.toThrow("symlinks");
  });
  it("provides instructions and references to every API harness", async () => {
    vi.stubEnv("OPENAI_API_KEY", "fixture");
    vi.stubEnv("OPENROUTER_API_KEY", "fixture");
    vi.stubEnv("LOCAL_MODEL", "fixture");
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url) =>
        Response.json(
          String(url).includes("responses")
            ? {
                status: "completed",
                output: [{ content: [{ type: "output_text", text: "done" }] }],
              }
            : { choices: [{ message: { content: "done" } }] },
        ),
      );
    for (const provider of ["openai", "openrouter", "local"] as const) {
      await generate(
        provider,
        "fixture-model",
        "Task",
        "Context",
        new AbortController().signal,
        randomUUID(),
        [bundle],
      );
      const body = JSON.parse(String(fetcher.mock.calls.at(-1)?.[1]?.body));
      const instructions =
        provider === "openai" ? body.instructions : body.messages[0].content;
      expect(instructions).toContain("FINDING, EVIDENCE, NEXT STEP");
      expect(instructions).toContain("Cite observed facts");
      expect(instructions).toContain("no filesystem or script execution");
    }
  });
  it("materializes the full bundle for Codex including relative resources", async () => {
    const dir = path.join(dataDir, "test-workspace");
    const prompt = await skillInstructions([bundle], dir);
    expect(prompt).toContain("SKILL.md");
    const root = path.join(dir, ".agents", "skills", bundle.name);
    expect(await readFile(path.join(root, "SKILL.md"), "utf8")).toBe(content);
    expect(
      await readFile(path.join(root, "references/checklist.md"), "utf8"),
    ).toContain("Cite observed facts");
  });
  it("inherits workflow skills into nested agents and keeps snapshots on resume", async () => {
    await saveJson("skills", bundle.id, bundle);
    const nested = {
      ...blank,
      id: "nested-skills",
      nodes: [blank.nodes[0], makeNode("agent", "agent", 1, 1), blank.nodes[1]],
      edges: [
        { id: "a", source: "input", target: "agent" },
        { id: "b", source: "agent", target: "output" },
      ],
    };
    await saveJson("workflows", nested.id, nested);
    const parent = {
      ...blank,
      skillIds: [bundle.id],
      nodes: [
        blank.nodes[0],
        makeNode("workflow", "nested", 1, 1, { workflowId: nested.id }),
        blank.nodes[1],
      ],
      edges: [
        { id: "a", source: "input", target: "nested" },
        { id: "b", source: "nested", target: "output" },
      ],
    };
    const run = createRun(parent, "demo", randomUUID());
    await executeRun(
      run,
      {},
      new AbortController().signal,
      undefined,
      async () => {},
    );
    expect(run.status).toBe("completed");
    expect(JSON.stringify(run.nodes.output.output)).toContain("concise-review");
    run.status = "failed";
    const resumed = resumeRun(run, randomUUID());
    await removeSkill(bundle.id);
    expect(resumed.skillSnapshots?.[0].files["SKILL.md"]).toBe(
      bundle.files["SKILL.md"],
    );
  });
  it("scopes specialist skills to their agent and reuses them after uninstall", async () => {
    await saveJson("skills", bundle.id, bundle);
    vi.stubEnv("OPENAI_API_KEY", "fixture");
    const calls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      calls.push(JSON.parse(String(init?.body)).instructions);
      return Response.json({
        status: "completed",
        output: [{ content: [{ type: "output_text", text: "done" }] }],
      });
    });
    const workflow = {
      ...blank,
      nodes: [
        blank.nodes[0],
        makeNode("agent", "specialist", 1, 1, {
          skillIds: [bundle.id],
          prompt: "Specialist task",
        }),
        makeNode("agent", "plain", 2, 1, { prompt: "Plain task" }),
        blank.nodes[1],
      ],
      edges: [
        { id: "a", source: "input", target: "specialist" },
        { id: "b", source: "specialist", target: "plain" },
        { id: "c", source: "plain", target: "output" },
      ],
    };
    const previous = createRun(workflow, "live", randomUUID());
    await prepareRun(previous);
    previous.status = "failed";
    previous.input = {};
    await removeSkill(bundle.id);
    const resumed = resumeRun(previous, randomUUID());
    await executeRun(
      resumed,
      {},
      new AbortController().signal,
      undefined,
      async () => {},
    );
    expect(resumed.status).toBe("completed");
    expect(calls[0]).toContain("FINDING");
    expect(calls[1]).not.toContain("FINDING");
  });
});
