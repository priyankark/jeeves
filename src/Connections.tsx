import { useState } from "react";
import { Check, KeyRound, Loader2, PlugZap, ShieldCheck } from "lucide-react";
import { api } from "./api";
import type { Provider } from "../shared/schema";
export type Providers = {
  configurationVersion?: number;
  typesafe: boolean;
  openai: boolean;
  openrouter: boolean;
  local: boolean;
  codex: boolean;
  models: Record<Provider, string>;
};
type ConnectionProvider = Provider | "typesafe";
const keyLinks: Partial<Record<ConnectionProvider, string>> = {
  typesafe: "https://console.typesafe.ai",
  openai: "https://platform.openai.com/api-keys",
  openrouter: "https://openrouter.ai/settings/keys",
};
type CheckResult = {
  ok: boolean;
  detail: string;
  latencyMs: number;
  checkedAt: string;
  models?: string[];
};
const catalog: { id: ConnectionProvider; name: string; description: string }[] =
  [
    {
      id: "typesafe",
      name: "Jev · TypeSafe",
      description: "Choose routes and check quality with Jev.",
    },
    {
      id: "codex",
      name: "Codex harness",
      description: "Use your existing Codex CLI login.",
    },
    {
      id: "openai",
      name: "OpenAI",
      description: "Writing and analysis using your OpenAI API key.",
    },
    {
      id: "openrouter",
      name: "OpenRouter",
      description: "Route tasks across hosted and open-source models.",
    },
    {
      id: "local",
      name: "Local model server",
      description: "Ollama, LM Studio, or another compatible endpoint.",
    },
  ];
export function Connections({
  providers,
  onChange,
  allowed,
}: {
  providers: Providers;
  onChange: (providers: Providers) => void;
  allowed?: ConnectionProvider[];
}) {
  const [expanded, setExpanded] = useState<ConnectionProvider | null>(null),
    [key, setKey] = useState(""),
    [model, setModel] = useState(""),
    [baseURL, setBaseURL] = useState("http://127.0.0.1:11434/v1"),
    [busy, setBusy] = useState<ConnectionProvider | null>(null),
    [results, setResults] = useState<
      Partial<Record<ConnectionProvider, CheckResult>>
    >({}),
    [error, setError] = useState("");
  async function check(provider: ConnectionProvider) {
    setBusy(provider);
    setError("");
    try {
      const result = await api<CheckResult>(`/connections/${provider}/check`, {
        method: "POST",
      });
      setResults((r) => ({ ...r, [provider]: result }));
    } catch (e) {
      setError((e as Error).message);
      setResults((r) => ({
        ...r,
        [provider]: {
          ok: false,
          detail:
            "Could not verify this connection. Try again when the service is available.",
          latencyMs: 0,
          checkedAt: new Date().toISOString(),
        },
      }));
    } finally {
      setBusy(null);
    }
  }
  async function save(provider: ConnectionProvider) {
    setBusy(provider);
    setError("");
    try {
      const status = await api<{ providers: Providers }>("/connections", {
        method: "PUT",
        body: JSON.stringify({
          provider,
          ...(key ? { apiKey: key } : {}),
          ...(model ? { model } : {}),
          ...(provider === "local" ? { baseURL } : {}),
          ...(provider === "codex" ? { enabled: true } : {}),
        }),
      });
      setKey("");
      onChange(status.providers);
      const result = await api<CheckResult>(`/connections/${provider}/check`, {
        method: "POST",
      });
      setResults((r) => ({ ...r, [provider]: result }));
      if (result.ok) setExpanded(null);
    } catch (e) {
      setError((e as Error).message);
      setResults((r) => ({
        ...r,
        [provider]: {
          ok: false,
          detail:
            "Could not verify this connection. Try again when the service is available.",
          latencyMs: 0,
          checkedAt: new Date().toISOString(),
        },
      }));
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="connections">
      <div className="connection-security">
        <ShieldCheck size={16} />
        <span>
          Keys are stored on this computer and used to connect to the selected
          service.
        </span>
      </div>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {catalog
        .filter((p) => !allowed || allowed.includes(p.id))
        .map((p) => (
          <div className="connection-card" key={p.id}>
            <div className="connection-card-top">
              <span className={`connection-symbol ${p.id}`}>
                {p.id === "typesafe" ? (
                  "∵"
                ) : p.id === "codex" ? (
                  ">_"
                ) : (
                  <PlugZap size={18} />
                )}
              </span>
              <div>
                <strong>{p.name}</strong>
                <p>{p.description}</p>
              </div>
              <span
                className={`connection-badge ${(results[p.id] ? results[p.id]!.ok : providers[p.id]) ? "connected" : ""}`}
              >
                {results[p.id]
                  ? results[p.id]!.ok
                    ? "Verified"
                    : "Check failed"
                  : providers[p.id]
                    ? "Configured"
                    : "Not connected"}
              </span>
            </div>
            {results[p.id] && (
              <div
                role="status"
                className={`connection-check ${results[p.id]!.ok ? "ok" : "failed"}`}
              >
                {results[p.id]!.ok && <Check size={12} />}
                <span>{results[p.id]!.detail}</span>
                {results[p.id]!.ok && (
                  <small>{results[p.id]!.latencyMs} ms</small>
                )}
              </div>
            )}
            <div className="connection-card-actions">
              <button
                className="text-link"
                disabled={busy !== null}
                onClick={() => {
                  setExpanded(expanded === p.id ? null : p.id);
                  setKey("");
                  setModel(
                    p.id === "typesafe" ? "jev-latest" : providers.models[p.id],
                  );
                  setError("");
                }}
              >
                {providers[p.id]
                  ? "Configure"
                  : p.id === "codex"
                    ? "Use CLI login"
                    : "Connect"}
              </button>
              {providers[p.id] && (
                <button
                  className="text-link"
                  disabled={busy !== null}
                  onClick={() => check(p.id)}
                >
                  {busy === p.id ? (
                    <Loader2 className="spin" size={12} />
                  ) : (
                    <Check size={12} />
                  )}
                  Test connection
                </button>
              )}
            </div>
            {expanded === p.id && (
              <form
                className="connection-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  save(p.id);
                }}
              >
                {keyLinks[p.id] && (
                  <a
                    className="connection-key-link"
                    href={keyLinks[p.id]}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open {p.id === "typesafe" ? "TypeSafe" : p.name} to get an
                    API key
                  </a>
                )}
                {p.id !== "codex" && (
                  <label>
                    {p.id === "local" ? "API key (optional)" : "API key"}
                    <input
                      aria-label={`${p.name} API key`}
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={
                        providers[p.id]
                          ? "Leave blank to keep the saved key"
                          : "Paste your API key"
                      }
                      value={key}
                      onChange={(e) => setKey(e.target.value)}
                    />
                  </label>
                )}
                {p.id === "local" && (
                  <label>
                    Server endpoint
                    <input
                      type="url"
                      value={baseURL}
                      onChange={(e) => setBaseURL(e.target.value)}
                    />
                  </label>
                )}
                <label>
                  Default model
                  <input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder={
                      p.id === "codex"
                        ? "Use your account default"
                        : "Exact model ID"
                    }
                  />
                </label>
                {p.id === "codex" && (
                  <p className="connection-hint">
                    Uses the Codex installation and account on this computer. No
                    API key is needed.
                  </p>
                )}
                <button
                  className="primary-button"
                  disabled={
                    busy !== null ||
                    (!providers[p.id] &&
                      !key &&
                      p.id !== "codex" &&
                      p.id !== "local")
                  }
                >
                  {busy === p.id ? (
                    <Loader2 className="spin" size={13} />
                  ) : (
                    <KeyRound size={13} />
                  )}
                  Save and verify
                </button>
              </form>
            )}
          </div>
        ))}
    </div>
  );
}
