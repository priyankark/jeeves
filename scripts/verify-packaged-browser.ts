import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { simulationServer } from "../tests/fixtures/simulation-server";
import { groceryCart } from "../shared/templates";
const fixture = await simulationServer();
const data = await mkdtemp(path.join(tmpdir(), "jeeves-packaged-browser-"));
const app = path.resolve("release/Jeeves-darwin-arm64/Jeeves.app/Contents");
const engine = spawn(
  path.join(app, "MacOS/Jeeves"),
  [path.join(app, "Resources/app/runtime/server.mjs")],
  {
    cwd: path.join(app, "Resources/app"),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: "4323",
      JEEVES_DATA_DIR: data,
      LOCAL_MODEL: "fixture-model",
      LOCAL_BASE_URL: fixture.origin + "/v1",
      LOCAL_API_KEY: "",
      ACTION_ALLOWED_ORIGINS: fixture.origin,
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let stderr = "";
engine.stderr.on("data", (chunk) => (stderr += chunk));
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch("http://127.0.0.1:4323/api/status")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(200);
  }
  if (!ready) throw new Error("Packaged engine failed: " + stderr);
  const workflow = structuredClone(groceryCart);
  workflow.nodes[1].data.url = fixture.origin + "/shop";
  workflow.nodes[1].data.provider = "local";
  workflow.nodes[1].data.model = "fixture-model";
  const response = await fetch("http://127.0.0.1:4323/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workflow,
      mode: "live",
      input: { task: "Add one oat milk and stop before checkout." },
    }),
  });
  let run = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(run));
  for (let i = 0; i < 100 && run.status === "running"; i++) {
    await delay(200);
    run = await fetch("http://127.0.0.1:4323/api/runs/" + run.id).then((r) =>
      r.json(),
    );
  }
  if (run.status !== "completed")
    throw new Error(JSON.stringify({ status: run.status, error: run.error }));
  const output = run.nodes.output.output;
  if (
    !output.summary.includes("$4.00") ||
    fixture.events.some((e) => e.path === "/purchase")
  )
    throw new Error("Incorrect grocery result");
  workflow.id = "packaged-login-smoke";
  workflow.nodes[1].data.url = fixture.origin + "/login-fixture";
  const save = await fetch(
    `http://127.0.0.1:4323/api/workflows/${workflow.id}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workflow),
    },
  );
  if (!save.ok) throw new Error(await save.text());
  const loginRequest = await fetch("http://127.0.0.1:4323/api/browser/logins", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workflowId: workflow.id,
      nodeId: workflow.nodes[1].id,
    }),
  });
  let login = await loginRequest.json();
  if (!loginRequest.ok) throw new Error(JSON.stringify(login));
  for (let i = 0; i < 50 && login.status === "working"; i++) {
    await delay(200);
    login = await fetch(
      `http://127.0.0.1:4323/api/browser/logins/${login.id}`,
    ).then((r) => r.json());
  }
  if (login.status !== "waiting")
    throw new Error("Login did not hand off: " + JSON.stringify(login));
  const blockedRun = await fetch("http://127.0.0.1:4323/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workflow, mode: "live", input: {} }),
  });
  if (
    blockedRun.ok ||
    !(await blockedRun.text()).includes("Finish or cancel browser sign-in")
  )
    throw new Error("Run was not blocked during sign-in");
  const finished = await fetch(
    `http://127.0.0.1:4323/api/browser/logins/${login.id}/finish`,
    { method: "POST", headers: { "Content-Type": "application/json" } },
  );
  if (!finished.ok || (await finished.json()).status !== "completed")
    throw new Error("Login confirmation failed");
  const report = {
    verifiedAt: new Date().toISOString(),
    runtime:
      "Electron packaged Node runtime; bundled playwright-core; system Google Chrome",
    model: "Synthetic local model endpoint",
    status: run.status,
    output,
    purchases: 0,
    login: {
      status: "completed",
      authentication: "User confirmation only; synthetic fixture",
      concurrentRunBlocked: true,
    },
  };
  await writeFile(
    "docs/packaged-browser-verification.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  engine.kill("SIGTERM");
  await new Promise<void>((resolve) => engine.once("exit", () => resolve()));
  await fixture.close();
}
