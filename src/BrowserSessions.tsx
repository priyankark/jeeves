import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import type { Run } from "../shared/schema";
import { api } from "./api";
export function BrowserSessions({ run }: { run: Run }) {
  const [opening, setOpening] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
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
            onClick={async () => {
              setOpening(n.id);
              setError("");
              setMessage("");
              try {
                await api(`/runs/${run.id}/browser/${n.id}/open`, {
                  method: "POST",
                });
                setMessage(
                  "Browser opened with the saved session. Close its Chrome window before running this step again.",
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setOpening("");
              }
            }}
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
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
