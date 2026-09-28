import { useEffect, useState } from "react";
import { X, CheckCircle2 } from "lucide-react";
import type { ChatSession } from "../shared/packages";
import type { Provider } from "../shared/schema";
import { Connections, type Providers } from "./Connections";
import { api } from "./api";
import { useDialogFocus } from "./useDialogFocus";

export const providerNames: Record<string, string> = {
  openai: "OpenAI",
  openrouter: "OpenRouter",
  local: "Local model",
  codex: "Codex CLI",
  typesafe: "Jev decisions",
};
const choices: Provider[] = ["openai", "codex", "openrouter", "local"];

export function WorkflowConnection({
  session,
  input,
  providers,
  disabled,
  onChange,
  onProviders,
}: {
  session: ChatSession;
  input: string;
  providers: Providers;
  disabled: boolean;
  onChange: (session: ChatSession) => void;
  onProviders: (providers: Providers) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Provider | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useDialogFocus(open, () => setOpen(false));
  const available = choices.filter((p) => providers[p]);
  const agents = Object.values(session.plan!.workflowSnapshots)
    .flatMap((w) => w.nodes)
    .filter((n) => n.data.kind === "agent");
  useEffect(() => {
    if (!selected || !providers[selected])
      setSelected(
        available.find((p) => agents.every((n) => n.data.provider === p)) ||
          available[0] ||
          "",
      );
  }, [providers, selected, session.id]);
  if (!agents.length) return null;
  const applied =
    !!selected &&
    agents.every(
      (n) =>
        n.data.provider === selected &&
        (!n.data.model || n.data.model === providers.models[selected]),
    );
  async function apply() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      onChange(
        await api<ChatSession>(`/chats/${session.id}/connection`, {
          method: "POST",
          body: JSON.stringify({
            revision: session.revision,
            provider: selected,
            model: providers.models[selected],
            input: JSON.parse(input),
          }),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="workflow-connection">
      <div className="connection-intro">
        <strong>
          {available.length
            ? "AI for this workflow"
            : "Connect AI to use your own input"}
        </strong>
        <p>
          {available.length
            ? "Choose one connection for the writing and analysis steps. Other steps keep their settings."
            : "Choose one service. You can reuse the connection for future workflows."}
        </p>
      </div>
      {available.length > 0 && (
        <div className="workflow-connection-actions">
          <label>
            AI connection
            <select
              aria-label="AI connection for this workflow"
              value={selected}
              disabled={disabled || busy}
              onChange={(e) => setSelected(e.target.value as Provider)}
            >
              {!selected && <option value="">Choose a connection</option>}
              {available.map((p) => (
                <option key={p} value={p}>
                  {providerNames[p]}
                </option>
              ))}
            </select>
          </label>
          {applied ? (
            <span className="connection-applied">
              <CheckCircle2 size={15} /> Applied to {agents.length}{" "}
              {agents.length === 1 ? "step" : "steps"}
            </span>
          ) : (
            <button
              className="secondary-button"
              disabled={disabled || busy || !selected}
              onClick={() => void apply()}
            >
              {busy ? "Applying…" : "Use this connection"}
            </button>
          )}
        </div>
      )}
      <button
        className="secondary-button"
        disabled={disabled || busy}
        onClick={() => setOpen(true)}
      >
        {available.length ? "Manage AI connections" : "Connect an AI service"}
      </button>
      <p className="connection-privacy">
        Cloud services receive your input and connected step results. Your
        provider’s usage charges may apply.
      </p>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Connect AI for your workflow"
            className="modal settings-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <h2>Connect AI for your workflow</h2>
                <p>
                  Pick one service you already use. Your task stays here while
                  you connect.
                </p>
              </div>
              <button
                aria-label="Close AI connections"
                className="icon-button"
                onClick={() => setOpen(false)}
              >
                <X size={19} />
              </button>
            </div>
            <Connections
              providers={providers}
              onChange={onProviders}
              allowed={choices}
            />
            <button className="primary-button" onClick={() => setOpen(false)}>
              Back to my task
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
