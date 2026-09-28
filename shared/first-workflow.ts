import { makeNode, type Workflow } from "./schema";

export const weeklyUpdateInput = {
  project: "Customer portal",
  notes:
    "Shipped the new sign-in page on Tuesday.\nMaya fixed the mobile navigation bug.\nBilling integration is blocked: waiting for sandbox access from the vendor.\nNext week: test billing and invite five pilot customers.",
};
export const weeklyDraftPrompt =
  "Turn the user's project notes into a concise weekly update. Use headings: Progress, Blockers, Next week. Use only facts in the notes; do not invent owners, dates, metrics, or completed work. If notes are empty, ask for notes instead of inventing an update. Return the update itself, ready to copy.";
export const weeklyReviewPrompt =
  "Check the draft against the original project notes in workflow input. Remove unsupported claims, retain blockers and next steps, and improve clarity. Return only the final weekly update with headings Progress, Blockers, Next week. Do not describe your instructions or claim to have sent the update.";
export const weeklyUpdate: Workflow = {
  id: "weekly-update",
  name: "Notes to weekly update",
  description:
    "Turn project notes into a concise update. Draft, check against your notes, and get text ready to share.",
  input: JSON.stringify(weeklyUpdateInput, null, 2),
  skillIds: [],
  nodes: [
    makeNode("input", "notes", 40, 180, { label: "Your project notes" }),
    makeNode("agent", "draft", 360, 180, {
      label: "Draft the update",
      prompt: weeklyDraftPrompt,
    }),
    makeNode("agent", "review", 680, 180, {
      label: "Check the facts",
      prompt: weeklyReviewPrompt,
    }),
    makeNode("output", "update", 1000, 180, { label: "Your weekly update" }),
  ],
  edges: [
    { id: "notes-draft", source: "notes", target: "draft" },
    { id: "draft-review", source: "draft", target: "review" },
    { id: "review-update", source: "review", target: "update" },
  ],
};

export const weeklySampleResult = `# Customer portal — weekly update

## Progress
- Shipped the new sign-in page on Tuesday.
- Maya fixed the mobile navigation bug.

## Blockers
- Billing integration is waiting on sandbox access from the vendor.

## Next week
- Test billing once access is available.
- Invite five pilot customers.`;
