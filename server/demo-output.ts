import { isDeepStrictEqual } from "node:util";
import {
  weeklyUpdateInput,
  weeklyDraftPrompt,
  weeklyReviewPrompt,
  weeklySampleResult,
  weeklyUpdate,
} from "../shared/first-workflow";
import type { Workflow } from "../shared/schema";

// A curated example is only valid for its exact input and instructions.
// Edited tasks must never receive canned output presented as their result.
export function sampleAgentOutput(
  prompt: string,
  input: unknown,
  workflow: Workflow,
): string | undefined {
  if (!isDeepStrictEqual(input, weeklyUpdateInput)) return;
  const structure = (w: Workflow) => ({
    nodes: w.nodes.map((n) => ({
      id: n.id,
      kind: n.data.kind,
      prompt: n.data.prompt,
    })),
    edges: w.edges.map((e) => ({ source: e.source, target: e.target })),
  });
  if (!isDeepStrictEqual(structure(workflow), structure(weeklyUpdate))) return;
  if (prompt !== weeklyDraftPrompt && prompt !== weeklyReviewPrompt) return;
  return `> Sample result · written for the example notes. No AI was called.\n\n${weeklySampleResult}`;
}
