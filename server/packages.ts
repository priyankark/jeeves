import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { zipSync, strToU8 } from "fflate";
import { z } from "zod";
import {
  workflowPackageSchema,
  type WorkflowPackage,
  type Requirements,
  type PackagePreview,
} from "../shared/packages";
import { workflowSchema, validateGraph, type Workflow } from "../shared/schema";
import { snapshotWorkflowTree } from "./engine";
import { resolveSkills, safeSkillPath, skillMetadata } from "./skills";
import { capabilities } from "./providers";
import { chromeInstalled } from "./browser";
import {
  isOriginAllowed,
  actionToken,
  integrationSecrets,
} from "./integrations";
import { saveJson } from "./storage";
export const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 58)
    .replace(/-$/, "") || "jeeves-workflow";
export function requirements(
  workflows: Record<string, Workflow>,
): Requirements {
  const r: Requirements = {
    providers: [],
    variables: [],
    models: [],
    origins: [],
    tools: ["Node.js 22.12+"],
    skills: [],
    missing: [],
    writes: [],
  };
  const caps = capabilities();
  for (const w of Object.values(workflows)) {
    r.skills.push(...w.skillIds);
    for (const n of w.nodes) {
      const d = n.data;
      r.skills.push(...d.skillIds);
      if (d.kind === "agent" || d.kind === "browser") {
        r.providers.push(d.provider);
        if (!caps[d.provider]) r.missing.push(`${d.provider} connection`);
        if (d.provider === "codex") {
          r.tools.push("Codex CLI with authentication");
          r.variables.push("ENABLE_CODEX=true");
        } else {
          const vars = {
            openai: "OPENAI_API_KEY",
            openrouter: "OPENROUTER_API_KEY",
            local: "LOCAL_BASE_URL, LOCAL_MODEL",
          };
          r.variables.push(vars[d.provider]);
        }
        const model = d.model || caps.models[d.provider];
        if (model) r.models.push(`${d.provider}: ${model}`);
        else if (d.provider !== "codex") r.missing.push(`${d.provider} model`);
      }
      if (d.kind === "decision" && d.decisionEngine === "jev") {
        r.providers.push("typesafe");
        r.variables.push("TYPESAFE_API_KEY");
        if (!caps.typesafe) r.missing.push("TypeSafe connection");
      }
      if (d.kind === "action" || d.kind === "browser") {
        let origin = "";
        try {
          origin = new URL(d.url).origin;
        } catch {
          r.missing.push(`Valid URL for ${d.label}`);
        }
        if (origin) {
          r.origins.push(origin);
          if (!isOriginAllowed(origin))
            r.missing.push(`Allow action origin ${origin}`);
        }
        if (d.kind === "action" && d.method === "POST")
          r.writes.push(`${d.label}: POST ${origin}`);
        if (d.kind === "action" && d.authEnv) {
          r.variables.push(d.authEnv);
          try {
            actionToken(d.authEnv, origin);
          } catch {
            r.missing.push(`${d.authEnv} credential for ${origin}`);
          }
        }
        if (d.kind === "browser") {
          r.tools.push("Google Chrome (installed locally)");
          if (!chromeInstalled())
            r.missing.push("Install Google Chrome for browser tasks");
          if (origin.endsWith(".example"))
            r.missing.push(`Replace the placeholder website in ${d.label}`);
          if (d.browserMode === "interact")
            r.writes.push(
              `${d.label}: browser clicks and form entry on ${origin}; manual checkout review`,
            );
        }
      }
    }
  }
  for (const key of Object.keys(r) as (keyof Requirements)[])
    r[key] = [...new Set(r[key])];
  return r;
}
export function validatePackage(raw: unknown): WorkflowPackage {
  const p = workflowPackageSchema.parse(raw);
  if (JSON.stringify(p).length > 24_000_000)
    throw new Error("Workflow package exceeds 24 MB.");
  if (
    !Object.hasOwn(p.workflows, p.rootId) ||
    Object.keys(p.workflows).length > 30
  )
    throw new Error(
      "A package needs its root workflow and at most 30 workflows.",
    );
  const ids = new Set(p.skills.map((s) => s.id));
  if (ids.size !== p.skills.length) throw new Error("Duplicate skill IDs.");
  for (const [id, w] of Object.entries(p.workflows)) {
    if (id !== w.id) throw new Error("Workflow ID mismatch in package.");
    const errors = validateGraph(w);
    if (errors.length) throw new Error(errors.join(" "));
    for (const sid of [
      ...w.skillIds,
      ...w.nodes.flatMap((n) => n.data.skillIds),
    ])
      if (!ids.has(sid))
        throw new Error(`Package is missing assigned skill ${sid}.`);
  }
  const visited = new Set<string>();
  function visit(id: string, stack: string[]) {
    if (stack.includes(id) || stack.length >= 5)
      throw new Error("Recursive or overly deep packaged workflows.");
    if (!Object.hasOwn(p.workflows, id))
      throw new Error(`Missing nested workflow ${id}.`);
    visited.add(id);
    for (const n of p.workflows[id].nodes)
      if (n.data.kind === "workflow") visit(n.data.workflowId, [...stack, id]);
  }
  visit(p.rootId, []);
  if (visited.size !== Object.keys(p.workflows).length)
    throw new Error("Package contains unrelated workflows.");
  for (const s of p.skills) {
    const entries = Object.entries(s.files);
    if (!Object.hasOwn(s.files, "SKILL.md") || entries.length > 150)
      throw new Error("Invalid skill bundle.");
    let bytes = 0;
    for (const [file, data] of entries) {
      safeSkillPath(file);
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(data))
        throw new Error("Skill resource is not base64.");
      bytes += Buffer.from(data, "base64").length;
    }
    if (bytes > 4_000_000) throw new Error("Skill bundle exceeds 4 MB.");
    if (
      skillMetadata(Buffer.from(s.files["SKILL.md"], "base64").toString())
        .name !== s.name
    )
      throw new Error("Skill metadata does not match bundle.");
  }
  return p;
}
export function secretFindings(p: WorkflowPackage): string[] {
  const findings: string[] = [];
  const known = Object.entries(process.env)
    .filter(
      ([key, value]) =>
        /KEY|TOKEN|SECRET|PASSWORD/.test(key) && value && value.length > 12,
    )
    .map(([, value]) => value!)
    .concat(integrationSecrets());
  function check(value: unknown, at: string) {
    if (typeof value === "string") {
      if (
        known.some((k) => value.includes(k)) ||
        /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{25,})\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|Bearer\s+[A-Za-z0-9._-]{16,}|https?:\/\/[^\s/]+:[^\s/]+@/i.test(
          value,
        )
      )
        findings.push(at);
    } else if (Array.isArray(value))
      value.forEach((v, i) => check(v, `${at}[${i}]`));
    else if (value && typeof value === "object")
      Object.entries(value).forEach(([k, v]) => check(v, `${at}.${k}`));
  }
  check(p.workflows, "workflows");
  for (const skill of p.skills)
    for (const [file, content] of Object.entries(skill.files))
      check(
        Buffer.from(content, "base64").toString(),
        `skills.${skill.name}/${file}`,
      );
  return [...new Set(findings)];
}
export async function previewPackage(raw: unknown): Promise<PackagePreview> {
  const body = z
    .object({
      workflow: workflowSchema,
      author: z.string().max(100).default(""),
      license: z
        .enum(["MIT", "Apache-2.0", "CC0-1.0", "Private"])
        .default("MIT"),
      includeInput: z.boolean().default(false),
      tags: z.array(z.string().max(30)).max(8).default([]),
    })
    .parse(raw);
  const workflows = await snapshotWorkflowTree(body.workflow);
  const caps = capabilities();
  for (const w of Object.values(workflows)) {
    if (!body.includeInput) {
      const template = (v: unknown): unknown =>
        Array.isArray(v)
          ? v.slice(0, 1).map(template)
          : v && typeof v === "object"
            ? Object.fromEntries(
                Object.entries(v).map(([k, value]) => [k, template(value)]),
              )
            : typeof v === "number"
              ? 0
              : typeof v === "boolean"
                ? false
                : v === null
                  ? null
                  : "Provide a value";
      try {
        w.input = JSON.stringify(template(JSON.parse(w.input)), null, 2);
      } catch {
        w.input = JSON.stringify({ task: "Describe your task here." }, null, 2);
      }
    }
    for (const n of w.nodes)
      if (
        (n.data.kind === "agent" || n.data.kind === "browser") &&
        !n.data.model
      )
        n.data.model = caps.models[n.data.provider];
  }
  const skills = await resolveSkills(
    Object.values(workflows).flatMap((w) => [
      ...w.skillIds,
      ...w.nodes.flatMap((n) => n.data.skillIds),
    ]),
  );
  const p = validatePackage({
    format: "jeeves-workflow",
    version: 1,
    name: body.workflow.name,
    description: body.workflow.description,
    rootId: body.workflow.id,
    workflows,
    skills,
    author: body.author,
    license: body.license,
    tags: body.tags,
  });
  return {
    package: p,
    requirements: requirements(workflows),
    findings: secretFindings(p),
    slug: slugify(p.name),
    bytes: Buffer.byteLength(JSON.stringify(p)),
  };
}
export async function importPackage(raw: unknown) {
  const p = validatePackage(raw);
  const mapping = new Map(
    Object.keys(p.workflows).map((id) => [id, randomUUID()]),
  );
  const skillMapping = new Map<string, string>();
  for (const s of p.skills) {
    const id = `skill-${createHash("sha256")
      .update(JSON.stringify([s.name, s.repo, s.commit, s.files]))
      .digest("hex")
      .slice(0, 32)}`;
    skillMapping.set(s.id, id);
    await saveJson("skills", id, {
      ...s,
      id,
      installedAt: new Date().toISOString(),
    });
  }
  const imported = Object.values(p.workflows).map((w) => ({
    ...w,
    id: mapping.get(w.id)!,
    skillIds: w.skillIds.map((id) => skillMapping.get(id)!),
    nodes: w.nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        skillIds: n.data.skillIds.map((id) => skillMapping.get(id)!),
        workflowId:
          n.data.kind === "workflow"
            ? mapping.get(n.data.workflowId)!
            : n.data.workflowId,
      },
    })),
  }));
  // Install children before exposing the root in the library.
  for (const w of imported.filter((w) => w.id !== mapping.get(p.rootId)))
    await saveJson("workflows", w.id, w);
  const root = imported.find((w) => w.id === mapping.get(p.rootId))!;
  await saveJson("workflows", root.id, root);
  return root;
}
export async function skillArchive(p: WorkflowPackage): Promise<Uint8Array> {
  p = validatePackage(p);
  if (secretFindings(p).length)
    throw new Error("Remove detected credentials before exporting.");
  const slug = slugify(p.name),
    files: Record<string, Uint8Array> = {};
  const add = (file: string, text: string | Uint8Array) => {
    files[`${slug}/${file}`] = typeof text === "string" ? strToU8(text) : text;
  };
  const r = requirements(p.workflows);
  add("workflow.json", JSON.stringify(p, null, 2));
  add("scripts/run.cjs", await readFile(path.resolve("runtime/runner.cjs")));
  if (
    Object.values(p.workflows).some((w) =>
      w.nodes.some((n) => n.data.kind === "browser"),
    )
  ) {
    const base = path.resolve("runtime/node_modules/playwright-core");
    async function include(dir: string) {
      for (const entry of await readdir(path.join(base, dir), {
        withFileTypes: true,
      })) {
        const file = path.posix.join(dir, entry.name);
        if (entry.isDirectory()) await include(file);
        else if (entry.isFile())
          add(
            `scripts/node_modules/playwright-core/${file}`,
            await readFile(path.join(base, file)),
          );
      }
    }
    await include("");
  }
  add("RUNNER_LICENSE.txt", await readFile(path.resolve("LICENSE")));
  add(
    "THIRD_PARTY_NOTICES.txt",
    await readFile(path.resolve("runtime/THIRD_PARTY_NOTICES.txt")),
  );
  add("input.example.json", p.workflows[p.rootId].input);
  add(
    ".env.example",
    [
      ...r.variables.map((v) =>
        v === "ENABLE_CODEX=true"
          ? v
          : v
              .split(", ")
              .map((k) => `${k}=`)
              .join("\n"),
      ),
      "# Explicitly allow HTTP actions before running them:",
      `ACTION_ALLOWED_ORIGINS=${r.origins.join(",")}`,
    ].join("\n"),
  );
  add(
    "SKILL.md",
    `---\nname: ${slug}\ndescription: ${JSON.stringify(`Run the ${p.name} workflow. ${p.description}`.slice(0, 1024))}\ncompatibility: ${JSON.stringify("Requires Node.js 22.12+, shell execution permission, network access for remote providers, and the credentials/tools listed in references/requirements.md.")}\n---\n\n# ${p.name}\n\nUse this skill to execute the bundled workflow when the user's task matches its purpose. The workflow and nested agents run through the included engine; do not manually imitate their outputs.\n\n1. Read [requirements](references/requirements.md) and check the environment with \`node <skill-directory>/scripts/run.cjs --check\`. Resolve missing tools or credentials through the user's environment; do not write secrets into this skill.\n2. Create an input JSON file using [the example](input.example.json) and the user's actual task. Preserve the configured input structure.\n3. For a simulation use \`node <skill-directory>/scripts/run.cjs --mode demo --input <input-file> --output <writable-directory>\`. For the user's requested real execution use \`--mode live\`. The live mode calls the listed providers and may perform the listed HTTP actions; stay within the user's requested scope.\n4. Read the JSON report on stdout and the saved run/result files. Report actual results and failures. Do not automatically rerun failed external actions.\n\nA harness must be able to launch Node and write output files. The skill does not require the Jeeves desktop app, npm install, or a Jeeves account. Use \`--help\` for provider/model overrides and checkpoint recovery.\n`,
  );
  add(
    "references/requirements.md",
    `# ${p.name}: execution requirements\n\n${p.description}\n\n- Runtime: ${r.tools.join("; ")}\n- Environment: ${r.variables.join("; ") || "None"}\n- Models: ${r.models.join("; ") || "None"}\n- Allowed HTTP origins: ${r.origins.join(", ") || "None"}\n- External writes: ${r.writes.join("; ") || "None"}\n- Bundled agent skills: ${p.skills.map((s) => `${s.name} (${s.repo}@${s.commit})`).join("; ") || "None"}\n\nEnvironment values are read from the process or a .env file in the invoking working directory. API keys are never bundled. Codex steps require the Codex executable and an authenticated account or API setup. Local model steps require an accessible compatible server and model. Use --provider and --model to explicitly replace agent providers if needed.\n\nWorkflow license: ${p.license}. Runner: MIT. Bundled skills retain their own licenses and notices embedded in workflow.json. API harnesses use skill instructions and text references; they do not gain script execution tools. The Codex harness stays read-only.\n`,
  );
  return zipSync(files, { level: 6 });
}
