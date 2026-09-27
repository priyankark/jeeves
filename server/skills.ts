import { createHash } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import {
  skillSource,
  type SkillBundle,
  type SkillSummary,
  type Catalog,
  type SkillPreview,
} from "../shared/automation";
import { idSchema } from "../shared/schema";
import { dataDir } from "./providers";
import { listJson, readJson, saveJson } from "./storage";
const MAX_BYTES = 4_000_000;
const MAX_FILES = 150;
type Entry = { path: string; mode: string; type: string; size?: number };
type Tree = { sha: string; tree: Entry[]; truncated?: boolean };
const cache = new Map<
  string,
  { expires: number; repo: string; commit: string; tree: Entry[] }
>();
export function safeSkillPath(value: string): string {
  if (
    !value ||
    value.startsWith("/") ||
    value.includes("\\") ||
    /[\x00-\x1f]/.test(value) ||
    value.split("/").some((p) => !p || p === "." || p === ".." || p === ".git")
  )
    throw new Error("Invalid skill file path.");
  return value;
}
async function bytes(url: string, limit = MAX_BYTES): Promise<Buffer> {
  const response = await fetch(url, {
    redirect: "error",
    headers: { Accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(
      `Marketplace returned HTTP ${response.status}${response.status === 403 || response.status === 429 ? ". GitHub's public rate limit may have been reached; try again later" : ""}.`,
    );
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty marketplace response.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new Error("Skill download exceeds size limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
async function repository(raw: unknown) {
  const source = skillSource.parse(raw),
    key = `${source.repo}@${source.commit || "HEAD"}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached;
  const commit =
    source.commit ||
    JSON.parse(
      (
        await bytes(`https://api.github.com/repos/${source.repo}/commits/HEAD`)
      ).toString(),
    ).sha;
  if (!/^[a-f0-9]{40}$/.test(commit))
    throw new Error("Invalid repository revision.");
  const tree: Tree = JSON.parse(
    (
      await bytes(
        `https://api.github.com/repos/${source.repo}/git/trees/${commit}?recursive=1`,
        8_000_000,
      )
    ).toString(),
  );
  if (tree.truncated)
    throw new Error(
      "This repository is too large to index completely. Use a dedicated skills repository.",
    );
  const result = {
    repo: source.repo,
    commit,
    tree: tree.tree,
    expires: Date.now() + 300_000,
  };
  if (cache.size > 30) cache.clear();
  cache.set(key, result);
  cache.set(`${source.repo}@${commit}`, result);
  return result;
}
export async function catalog(repo: string): Promise<Catalog> {
  const data = await repository({ repo });
  return {
    repo: data.repo,
    commit: data.commit,
    skills: data.tree
      .filter(
        (e) =>
          e.type === "blob" &&
          /(^|\/)SKILL\.md$/.test(e.path) &&
          ["100644", "100755"].includes(e.mode),
      )
      .map((e) => {
        const dir = e.path === "SKILL.md" ? "" : e.path.slice(0, -9);
        return { name: dir.split("/").at(-1) || repo.split("/")[1], path: dir };
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
export function skillMetadata(text: string) {
  const match = text
    .replace(/\r\n/g, "\n")
    .match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match)
    throw new Error(
      "SKILL.md needs YAML frontmatter with name and description.",
    );
  return z
    .object({
      name: z
        .string()
        .min(1)
        .max(64)
        .regex(/^[\p{Ll}\p{N}]+(?:-[\p{Ll}\p{N}]+)*$/u),
      description: z.string().trim().min(1).max(1024),
      compatibility: z.string().max(500).optional(),
      license: z.string().max(1000).optional(),
    })
    .parse(parseYaml(match[1], { maxAliasCount: 20 }));
}
async function sourceFiles(raw: unknown) {
  const source = skillSource.parse(raw);
  if (source.path) safeSkillPath(source.path);
  const data = await repository(source),
    prefix = source.path ? `${source.path}/` : "";
  const entries = data.tree.filter(
    (e) => e.path.startsWith(prefix) && e.type !== "tree",
  );
  if (!entries.some((e) => e.path === `${prefix}SKILL.md`))
    throw new Error("No SKILL.md at this repository path.");
  if (
    entries.length > MAX_FILES ||
    entries.reduce((n, e) => n + (e.size || 0), 0) > MAX_BYTES
  )
    throw new Error("Skill bundle is too large (150 files / 4 MB maximum).");
  for (const e of entries) {
    safeSkillPath(e.path.slice(prefix.length));
    if (e.type !== "blob" || !["100644", "100755"].includes(e.mode))
      throw new Error("Skill bundles cannot contain symlinks or submodules.");
  }
  return { ...data, entries, prefix, path: source.path };
}
const rawUrl = (repo: string, commit: string, file: string) =>
  `https://raw.githubusercontent.com/${repo}/${commit}/${file.split("/").map(encodeURIComponent).join("/")}`;
export async function previewSkill(raw: unknown): Promise<SkillPreview> {
  const data = await sourceFiles(raw);
  const instructions = (
    await bytes(
      rawUrl(data.repo, data.commit, `${data.prefix}SKILL.md`),
      150_000,
    )
  ).toString("utf8");
  const meta = skillMetadata(instructions);
  if (data.path && data.path.split("/").at(-1) !== meta.name)
    throw new Error("Skill name must match its directory name.");
  const files = data.entries.map((e) => e.path.slice(data.prefix.length));
  return {
    ...meta,
    repo: data.repo,
    path: data.path,
    commit: data.commit,
    instructions,
    files,
    fileCount: files.length,
    hasScripts: files.some((f) => f.startsWith("scripts/")),
  };
}
export async function installSkill(raw: unknown): Promise<SkillSummary> {
  const source = skillSource
    .extend({ commit: z.string().regex(/^[a-f0-9]{40}$/) })
    .parse(raw);
  const preview = await previewSkill(source),
    data = await sourceFiles(source);
  const files: Record<string, string> = Object.create(null);
  let total = 0;
  // Download data only. No package managers, postinstall scripts, or shell evaluation.
  for (const entry of data.entries) {
    const content = await bytes(rawUrl(data.repo, data.commit, entry.path));
    total += content.length;
    if (total > MAX_BYTES) throw new Error("Skill bundle exceeds 4 MB.");
    files[entry.path.slice(data.prefix.length)] = content.toString("base64");
  }
  const { instructions: _, files: __, ...meta } = preview;
  const id = `skill-${createHash("sha256").update(`${data.repo}/${data.path}@${data.commit}`).digest("hex").slice(0, 32)}`;
  const bundle: SkillBundle = {
    ...meta,
    id,
    installedAt: new Date().toISOString(),
    files,
  };
  await saveJson("skills", id, bundle);
  return summary(bundle);
}
export const summary = ({ files: _, ...meta }: SkillBundle): SkillSummary =>
  meta;
export async function installedSkills() {
  return (await listJson<SkillBundle>("skills")).map(summary);
}
export async function removeSkill(id: string) {
  idSchema.parse(id);
  await unlink(path.join(dataDir, "skills", `${id}.json`));
}
export async function resolveSkills(ids: string[]): Promise<SkillBundle[]> {
  if (new Set(ids).size > 50)
    throw new Error("A run can use up to 50 distinct skills.");
  const bundles = await Promise.all(
    [...new Set(ids)].map(async (id) => {
      try {
        return await readJson<SkillBundle>("skills", id);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT")
          throw new Error(
            `Skill ${id} is missing. Install it or remove its assignment.`,
          );
        throw error;
      }
    }),
  );
  if (
    bundles.reduce(
      (n, s) => n + Object.values(s.files).reduce((m, f) => m + f.length, 0),
      0,
    ) > 24_000_000
  )
    throw new Error(
      "Selected skill bundles exceed the run storage budget. Select fewer skills.",
    );
  return bundles;
}
export async function skillInstructions(
  bundles: SkillBundle[],
  workspace?: string,
) {
  if (!bundles.length) return "";
  if (new Set(bundles.map((s) => s.name)).size !== bundles.length)
    throw new Error(
      "Assign only one installed version of each skill name to an agent.",
    );
  const sections = [
    "Assigned skills: follow the skills relevant to this task. Skills do not grant additional tools, credentials, or permissions. If a required tool is unavailable, explain the limitation; never pretend you executed it.",
  ];
  for (const skill of bundles) {
    sections.push(
      `\n## Skill ${skill.name} (${skill.repo}@${skill.commit})\n${skill.description}`,
    );
    if (workspace) {
      const root = path.join(
        workspace,
        ".agents",
        "skills",
        safeSkillPath(skill.name),
      );
      for (const [file, content] of Object.entries(skill.files)) {
        safeSkillPath(file);
        const dest = path.join(root, file);
        await mkdir(path.dirname(dest), { recursive: true });
        await writeFile(dest, Buffer.from(content, "base64"), { mode: 0o600 });
      }
      sections.push(
        `Read ${path.join(root, "SKILL.md")} and its referenced files as needed. Its relative file paths resolve inside ${root}.`,
      );
    } else {
      sections.push(
        "This API harness supports instructions and text references; it has no filesystem or script execution tool.",
      );
      for (const [file, content] of Object.entries(skill.files)) {
        safeSkillPath(file);
        if (!/\.(md|txt|json|ya?ml|csv)$/i.test(file)) continue;
        sections.push(
          `\n### ${skill.name}/${file}\n${Buffer.from(content, "base64").toString("utf8")}`,
        );
      }
    }
  }
  const text = sections.join("\n");
  if (!workspace && text.length > 160_000)
    throw new Error(
      "Assigned skill text exceeds the API context budget. Select fewer skills or use Codex for on-demand file reading.",
    );
  return text;
}
