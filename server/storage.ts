import { mkdir, readFile, readdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { dataDir } from "./providers";
import {
  idSchema,
  workflowSchema,
  type Workflow,
  type Run,
} from "../shared/schema";
import { templates } from "../shared/templates";
export async function saveJson(collection: string, id: string, data: unknown) {
  idSchema.parse(id);
  const dir = path.join(dataDir, collection);
  await mkdir(dir, { recursive: true });
  const dest = path.join(dir, `${id}.json`),
    temp = `${dest}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
  await rename(temp, dest);
}
export async function readJson<T>(collection: string, id: string): Promise<T> {
  idSchema.parse(id);
  return JSON.parse(
    await readFile(path.join(dataDir, collection, `${id}.json`), "utf8"),
  );
}
export async function listJson<T>(collection: string): Promise<T[]> {
  const dir = path.join(dataDir, collection);
  await mkdir(dir, { recursive: true });
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  return Promise.all(
    files.map((file) => readJson<T>(collection, file.slice(0, -5))),
  );
}
export async function initialize() {
  if (!(await listJson<Workflow>("workflows")).length)
    for (const template of templates)
      await saveJson("workflows", template.id, template);
  for (const run of await listJson<Run>("runs"))
    if (run.status === "running") {
      run.status = "failed";
      run.error = "Server restarted before this run completed.";
      run.finishedAt = new Date().toISOString();
      for (const node of Object.values(run.nodes))
        if (node.status === "running" || node.status === "pending")
          node.status = "cancelled";
      await saveJson("runs", run.id, run);
    }
}
export async function getWorkflow(id: string) {
  return workflowSchema.parse(await readJson("workflows", id));
}
