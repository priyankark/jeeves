import path from "node:path";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";
import { config } from "dotenv";
async function main() {
  const { values } = parseArgs({
    options: {
      help: { type: "boolean" },
      check: { type: "boolean" },
      mode: { type: "string", default: "demo" },
      input: { type: "string" },
      json: { type: "string" },
      output: { type: "string" },
      package: { type: "string" },
      provider: { type: "string" },
      model: { type: "string" },
      resume: { type: "string" },
      "retry-actions": { type: "boolean" },
    },
  });
  if (values.help) {
    console.log(
      `Jeeves portable workflow runner\n\nnode scripts/run.cjs --check\nnode scripts/run.cjs --mode demo|live --input input.json --output ./results\n\nOptions: --json '{"task":"..."}' instead of --input; --provider openai|openrouter|local|codex and --model ID explicitly override all agent nodes. --resume path/to/run.json continues a failed checkpoint; --retry-actions permits replaying possibly delivered HTTP or browser actions after checking their destinations. Credentials are read from environment or .env in the current working directory. No Jeeves installation or npm install required.`,
    );
    return;
  }
  if (!["demo", "live"].includes(values.mode!))
    throw new Error("--mode must be demo or live.");
  if (values.input && values.json)
    throw new Error("Choose --input or --json, not both.");
  config({ path: path.resolve(".env"), quiet: true });
  const outputDir = path.resolve(
    values.output || path.join(process.cwd(), `jeeves-results-${Date.now()}`),
  );
  process.env.JEEVES_DATA_DIR = outputDir;
  const { validatePackage, requirements } = await import("../server/packages");
  const { createRun, executeRun, resumeRun, uncertainActions } =
    await import("../server/engine");
  const { providerSchema } = await import("../shared/schema");
  const file = values.package
    ? path.resolve(values.package)
    : path.resolve(__dirname, "../workflow.json");
  const p = validatePackage(JSON.parse(await readFile(file, "utf8")));
  if (values.provider || values.model)
    for (const w of Object.values(p.workflows))
      for (const n of w.nodes)
        if (n.data.kind === "agent" || n.data.kind === "browser") {
          if (values.provider) {
            n.data.provider = providerSchema.parse(values.provider);
            n.data.model = "";
          }
          if (values.model) n.data.model = values.model;
        }
  const needed = requirements(p.workflows);
  if (needed.providers.includes("codex")) {
    const check = spawnSync("codex", ["login", "status"], {
      encoding: "utf8",
      timeout: 15000,
    });
    if (check.status !== 0)
      needed.missing.push("Codex CLI authentication (run codex login)");
    else {
      process.env.ENABLE_CODEX = "true";
      needed.missing = needed.missing.filter((x) => x !== "codex connection");
    }
  }
  if (Number(process.versions.node.split(".")[0]) < 22)
    needed.missing.push("Node.js 22.12+");
  if (values.check) {
    console.log(
      JSON.stringify(
        { workflow: p.name, ready: !needed.missing.length, ...needed },
        null,
        2,
      ),
    );
    process.exitCode = needed.missing.length ? 2 : 0;
    return;
  }
  let run;
  if (values.resume) {
    if (values.provider || values.model || values.input || values.json)
      throw new Error(
        "Checkpoint recovery preserves the original inputs, model, and provider.",
      );
    const prior = JSON.parse(
      await readFile(path.resolve(values.resume), "utf8"),
    );
    if (uncertainActions(prior).length && !values["retry-actions"])
      throw new Error(
        "An HTTP or browser action may already have changed external data. Check its destination before using --retry-actions.",
      );
    run = resumeRun(prior, randomUUID());
  } else {
    const input = values.input
      ? JSON.parse(await readFile(path.resolve(values.input), "utf8"))
      : values.json
        ? JSON.parse(values.json)
        : JSON.parse(p.workflows[p.rootId].input);
    run = createRun(
      p.workflows[p.rootId],
      values.mode as "demo" | "live",
      randomUUID(),
    );
    run.input = input;
    run.workflowSnapshots = p.workflows;
    run.skillSnapshots = p.skills;
  }
  if (run.mode === "live" && needed.missing.length)
    throw new Error(
      `Missing prerequisites: ${needed.missing.join("; ")}. Use --check for details.`,
    );
  await mkdir(outputDir, { recursive: true });
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  process.once("SIGTERM", () => controller.abort());
  await executeRun(run, run.input, controller.signal);
  const results = Object.fromEntries(
    run.workflow.nodes
      .filter((n) => n.data.kind === "output")
      .map((n) => [n.id, run.nodes[n.id].output]),
  );
  const report = {
    status: run.status,
    mode: run.mode,
    runId: run.id,
    error: run.error,
    checkpoint: path.join(outputDir, "runs", `${run.id}.json`),
    artifacts: path.join(outputDir, "artifacts"),
    results,
  };
  await writeFile(
    path.join(outputDir, "result.json"),
    JSON.stringify(report, null, 2),
    { mode: 0o600 },
  );
  console.log(JSON.stringify(report, null, 2));
  if (run.status !== "completed") process.exitCode = 1;
}
main().catch((error) => {
  console.error(JSON.stringify({ status: "error", error: error.message }));
  process.exitCode = 1;
});
