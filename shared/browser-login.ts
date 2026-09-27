export type BrowserLogin = {
  id: string;
  workflowId: string;
  nodeId: string;
  status: "working" | "waiting" | "completed" | "cancelled" | "failed";
  message: string;
};
