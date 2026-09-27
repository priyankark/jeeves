import { z } from "zod";
import { idSchema, workflowSchema } from "./schema";
export const scheduleInput = z.object({
  name: z.string().trim().min(1).max(100),
  workflow: workflowSchema,
  mode: z.enum(["demo", "live"]),
  input: z
    .string()
    .max(30000)
    .refine((v) => {
      try {
        JSON.parse(v);
        return true;
      } catch {
        return false;
      }
    }, "Input must be valid JSON."),
  kind: z.enum(["cron", "once"]),
  cron: z.string().max(100).default("0 9 * * 1-5"),
  timezone: z.string().min(1).max(100),
  at: z.string().max(100).default(""),
  enabled: z.boolean().default(true),
  missed: z.enum(["skip", "once"]).default("skip"),
});
export type ScheduleInput = z.infer<typeof scheduleInput>;
export type Schedule = ScheduleInput & {
  id: string;
  createdAt: string;
  nextAt: string | null;
  workflowSnapshots?: Record<string, import("./schema").Workflow>;
  lastRunId?: string;
  lastAt?: string;
  lastOutcome?: string;
};
export type SkillSummary = {
  id: string;
  name: string;
  description: string;
  compatibility?: string;
  license?: string;
  repo: string;
  path: string;
  commit: string;
  installedAt: string;
  fileCount: number;
  hasScripts: boolean;
};
export type SkillBundle = SkillSummary & { files: Record<string, string> };
export type SkillPreview = Omit<SkillSummary, "id" | "installedAt"> & {
  instructions: string;
  files: string[];
};
export type Catalog = {
  repo: string;
  commit: string;
  skills: { name: string; path: string }[];
};
export const skillSource = z.object({
  repo: z
    .string()
    .regex(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/)
    .max(160),
  path: z.string().max(300).default(""),
  commit: z
    .string()
    .regex(/^[a-f0-9]{40}$/)
    .optional(),
});
export const skillSelection = z.array(idSchema).max(20).default([]);
