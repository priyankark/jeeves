import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import type { Run } from "../shared/schema";
import { api } from "./api";
import { WebsiteAccess } from "./WebsiteAccess";
import { FriendlyError } from "./FriendlyError";
export function BrowserSessions({ run }: { run: Run }) {
  const [opening, setOpening] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [failedNode, setFailedNode] = useState("");
  async function open(nodeId: string) {
    setOpening(nodeId);
    setError("");
    setMessage("");
    try {
      await api(`/runs/${run.id}/browser/${nodeId}/open`, { method: "POST" });
      setMessage(
        "Browser opened with the saved session. Close its Chrome window before running this step again.",
      );
    } catch (e) {
      setFailedNode(nodeId);
      setError((e as Error).message);
    } finally {
      setOpening("");
    }
  }
  if (run.mode !== "live" || run.status === "running") return null;
  const nodes = run.workflow.nodes.filter(
    (n) => n.data.kind === "browser" && run.nodes[n.id]?.startedAt,
  );
  if (!nodes.length) return null;
  return (
    <section className="browser-sessions" aria-label="Saved browser sessions">
      {nodes.map((n) => (
        <div key={n.id}>
          <button
            className="subtle-button"
            disabled={!!opening}
            onClick={() => void open(n.id)}
          >
            {opening === n.id ? (
              <Loader2 size={15} className="spin" />
            ) : (
              <ExternalLink size={15} />
            )}
            Review browser · {n.data.label}
          </button>
          {run.nodes[n.id].artifact?.endsWith(".png") &&
            ["failed", "cancelled"].includes(run.nodes[n.id].status) && (
              <a href={`/api/artifacts/${run.nodes[n.id].artifact}`} download>
                Download last browser screenshot
              </a>
            )}
        </div>
      ))}
      {message && <p role="status">{message}</p>}
      {error && (
        <div className="error-text" role="alert">
          <FriendlyError message={error} />
          <WebsiteAccess
            message={error}
            onRetry={() => open(failedNode)}
            retryLabel="Open browser again"
          />
        </div>
      )}
    </section>
  );
}
