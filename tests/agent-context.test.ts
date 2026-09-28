import { expect, it } from "vitest";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { prepareAgentContext } from "../server/agent-context";

async function workspace(name: string) {
  const directory = path.join(process.env.JEEVES_DATA_DIR!, name);
  await mkdir(directory, { recursive: true });
  return directory;
}

it("keeps small context inline without creating a file", async () => {
  const directory = await workspace("small");
  const input = '{"input":"Summarize","parents":{"read":{"items":[1,2]}}}';
  expect(await prepareAgentContext(input, directory)).toBe(input);
  expect(await readdir(directory)).toEqual([]);
});

it("preserves large JSON exactly while giving the agent a bounded navigation prompt", async () => {
  const directory = await workspace("large");
  const input = JSON.stringify({
    input: { task: "Triage issues" },
    parents: {
      issues: {
        items: Array.from({ length: 150 }, (_, number) => ({
          number,
          body: "issue details ".repeat(5000),
        })),
        pagination: { pages: 5, truncated: true },
      },
    },
  });
  expect(input.length).toBeGreaterThan(1_048_576);
  const prompt = await prepareAgentContext(input, directory);
  expect(prompt.length).toBeLessThan(10_000);
  expect(prompt).toContain("./workflow-context.json");
  expect(prompt).toContain("Triage issues");
  expect(prompt).toContain('"length": 150');
  expect(prompt).toContain("read-only tools");
  const file = path.join(directory, "workflow-context.json");
  expect(await readFile(file, "utf8")).toBe(input);
  expect((await stat(file)).mode & 0o777).toBe(0o600);
});

it("preserves non-JSON and Unicode context without encoding changes", async () => {
  const directory = await workspace("text");
  const input = "Context with café and 🌍\n".repeat(4000);
  const prompt = await prepareAgentContext(input, directory);
  expect(prompt).toContain("workflow-context.txt");
  expect(prompt).toContain(`${Buffer.byteLength(input)} bytes`);
  expect(
    await readFile(path.join(directory, "workflow-context.txt"), "utf8"),
  ).toBe(input);
});
