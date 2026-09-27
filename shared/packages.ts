import { z } from "zod";
import { workflowSchema, idSchema, type Workflow } from "./schema";
export const packageSkill = z.object({
  id: idSchema,
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().max(1024),
  repo: z.string().max(160),
  path: z.string().max(300),
  commit: z.string().max(80),
  installedAt: z.string(),
  fileCount: z.number().int().min(1).max(150),
  hasScripts: z.boolean(),
  license: z.string().max(1000).optional(),
  compatibility: z.string().max(500).optional(),
  files: z.record(z.string().max(400), z.string().max(5_500_000)),
});
export const workflowPackageSchema = z.object({
  format: z.literal("jeeves-workflow"),
  version: z.literal(1),
  name: z.string().trim().min(1).max(100),
  description: z.string().max(1000),
  author: z.string().trim().max(100).default(""),
  license: z.enum(["MIT", "Apache-2.0", "CC0-1.0", "Private"]).default("MIT"),
  tags: z.array(z.string().max(30)).max(8).default([]),
  rootId: idSchema,
  workflows: z.record(idSchema, workflowSchema),
  skills: z.array(packageSkill).max(50).default([]),
});
export type WorkflowPackage = z.infer<typeof workflowPackageSchema>;
export type Requirements = {
  providers: string[];
  variables: string[];
  models: string[];
  origins: string[];
  tools: string[];
  skills: string[];
  missing: string[];
  writes: string[];
};
export type PackagePreview = {
  package: WorkflowPackage;
  requirements: Requirements;
  findings: string[];
  slug: string;
  bytes: number;
};
export type WorkflowListing = {
  id: string;
  name: string;
  description: string;
  author: string;
  license: string;
  tags: string[];
  nodeCount: number;
  providers: string[];
  source: string;
  path?: string;
  sha256?: string;
  commit?: string;
};
export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  time: string;
};
export type ChatPlan = {
  workflow: Workflow;
  workflowSnapshots: Record<string, Workflow>;
  input: unknown;
  requirements: Requirements;
  source: "local" | "model";
};
export type ChatSession = {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
  plan?: ChatPlan;
  revision: string;
  runIds: string[];
  mode: "demo" | "live";
  executions?: Record<string, string>;
};
