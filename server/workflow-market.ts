import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { templates } from "../shared/templates";
import { type WorkflowListing, type WorkflowPackage } from "../shared/packages";
import { validatePackage, requirements, secretFindings } from "./packages";
import { safeSkillPath } from "./skills";
const repoSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-][A-Za-z0-9_.-]*\/[A-Za-z0-9_-][A-Za-z0-9_.-]*$/)
  .max(160);
const commitSchema = z.string().regex(/^[a-f0-9]{40}$/);
const cache = new Map<
  string,
  { expires: number; commit: string; listings: WorkflowListing[] }
>();
async function get(url: string, max = 24_000_000) {
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(30000),
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok)
    throw new Error(
      `Community source returned HTTP ${response.status}. Check the repository or try again after GitHub's public rate limit resets.`,
    );
  const reader = response.body!.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) {
        await reader.cancel();
        throw new Error("Marketplace response too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export function builtinPackages(): WorkflowPackage[] {
  return templates
    .filter((w) => w.nodes.length > 2)
    .map((w) =>
      validatePackage({
        format: "jeeves-workflow",
        version: 1,
        name: w.name,
        description: w.description,
        author: "Jeeves contributors",
        license: "MIT",
        tags:
          w.id === "request-triage"
            ? ["Jev", "Triage", "Human input"]
            : w.id.includes("github")
              ? ["GitHub", "Maintenance"]
              : w.id.includes("grocery")
                ? ["Browser", "Shopping"]
                : w.id.includes("review")
                  ? ["Writing", "Review"]
                  : ["Research", "Briefs"],
        rootId: w.id,
        workflows: { [w.id]: w },
        skills: [],
      }),
    );
}
export function listing(
  p: WorkflowPackage,
  source: string,
  id: string,
): WorkflowListing {
  return {
    id,
    name: p.name,
    description: p.description,
    author: p.author,
    license: p.license,
    tags: p.tags,
    nodeCount: Object.values(p.workflows).reduce(
      (n, w) => n + w.nodes.length,
      0,
    ),
    providers: requirements(p.workflows).providers,
    source,
  };
}
export async function workflowCatalog(repo?: string, revision?: string) {
  if (!repo)
    return {
      source: "Bundled starter collection",
      listings: builtinPackages().map((p) => listing(p, "bundled", p.rootId)),
    };
  repoSchema.parse(repo);
  if (revision) commitSchema.parse(revision);
  const key = `${repo}@${revision || "HEAD"}`,
    existing = cache.get(key);
  if (existing && existing.expires > Date.now())
    return {
      source: repo,
      commit: existing.commit,
      listings: existing.listings,
    };
  const commit =
    revision ||
    JSON.parse(
      (
        await get(
          `https://api.github.com/repos/${repo}/commits/HEAD`,
          1_000_000,
        )
      ).toString(),
    ).sha;
  commitSchema.parse(commit);
  const manifest = z
    .object({
      version: z.literal(1),
      workflows: z
        .array(
          z.object({
            id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
            name: z.string().max(100),
            description: z.string().max(1000),
            author: z.string().max(100).default(""),
            license: z.string().max(50),
            tags: z.array(z.string().max(30)).max(8).default([]),
            path: z.string().max(400),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            nodeCount: z.number().int().min(1).max(3000).default(1),
            providers: z.array(z.string()).max(10).default([]),
          }),
        )
        .max(300),
    })
    .parse(
      JSON.parse(
        (
          await get(
            `https://raw.githubusercontent.com/${repo}/${commit}/jeeves-marketplace.json`,
            1_000_000,
          )
        ).toString(),
      ),
    );
  const listings = manifest.workflows.map((w) => {
    safeSkillPath(w.path);
    if (!w.path.endsWith(".json"))
      throw new Error("Catalog entries must point to workflow JSON packages.");
    return { ...w, source: repo!, commit };
  });
  if (new Set(listings.map((w) => w.id)).size !== listings.length)
    throw new Error("Duplicate catalog entry IDs.");
  const entry = { expires: Date.now() + 300000, commit, listings };
  if (cache.size > 30) cache.clear();
  cache.set(key, entry);
  cache.set(`${repo}@${commit}`, entry);
  return { source: repo, commit, listings };
}
export async function marketplacePackage(raw: unknown) {
  const ref = z
    .object({
      id: z.string().max(80),
      repo: z.string().optional(),
      commit: z.string().optional(),
    })
    .parse(raw);
  if (!ref.repo) {
    const p = builtinPackages().find((p) => p.rootId === ref.id);
    if (!p) throw new Error("Workflow not found.");
    return p;
  }
  const catalog = await workflowCatalog(ref.repo, ref.commit);
  const item = catalog.listings.find((w) => w.id === ref.id);
  if (!item?.path) throw new Error("Workflow not found in this catalog.");
  const bytes = await get(
    `https://raw.githubusercontent.com/${ref.repo}/${item.commit}/${item.path.split("/").map(encodeURIComponent).join("/")}`,
  );
  if (createHash("sha256").update(bytes).digest("hex") !== item.sha256)
    throw new Error("Workflow checksum does not match the reviewed catalog.");
  const p = validatePackage(JSON.parse(bytes.toString()));
  if (secretFindings(p).length)
    throw new Error(
      "This workflow contains apparent embedded credentials; ask its author to remove them.",
    );
  return p;
}
