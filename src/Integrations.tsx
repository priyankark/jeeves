import { useEffect, useState } from "react";
import { api } from "./api";
type Status = {
  allowAllWebsites: boolean;
  environmentAllowsAll: boolean;
  origins: string[];
  environmentOrigins: string[];
  secrets: { name: string; origin: string }[];
};
export function Integrations({ onChange }: { onChange: () => void }) {
  const [status, setStatus] = useState<Status>({
    allowAllWebsites: false,
    environmentAllowsAll: false,
    origins: [],
    environmentOrigins: [],
    secrets: [],
  });
  const [origins, setOrigins] = useState("");
  const [name, setName] = useState("GITHUB_TOKEN"),
    [origin, setOrigin] = useState("https://api.github.com"),
    [value, setValue] = useState("");
  const [busy, setBusy] = useState(true),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    void api<Status>("/integrations")
      .then((s) => {
        setStatus(s);
        setOrigins(s.origins.join("\n"));
      })
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }, []);
  async function save(body: unknown) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const s = await api<Status>("/integrations", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setStatus(s);
      setOrigins(s.origins.join("\n"));
      setValue("");
      setMessage("Saved on this device.");
      onChange();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="integration-settings">
      <h3>Websites & API access</h3>
      <p>
        Choose which sites workflow HTTP and browser steps may contact. Browser
        sessions use a separate Chrome profile, never your everyday browser
        profile.
      </p>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <label className="access-mode">
        <input
          type="checkbox"
          checked={status.allowAllWebsites || status.environmentAllowsAll}
          disabled={busy || status.environmentAllowsAll}
          onChange={(e) => {
            const next = e.target.checked;
            const previous = status.allowAllWebsites;
            setStatus((s) => ({ ...s, allowAllWebsites: next }));
            void save({ allowAllWebsites: next }).then((ok) => {
              if (!ok) setStatus((s) => ({ ...s, allowAllWebsites: previous }));
            });
          }}
        />
        <span>
          <strong>Allow all websites & APIs</strong>
          <small>
            Applies to every workflow on this device, including browser requests
            and redirects. API credentials stay restricted to their saved
            websites. Sign-ins and checkout still require you.
          </small>
        </span>
      </label>
      {status.environmentAllowsAll && (
        <p className="field-note">
          Enabled by ACTION_ALLOWED_ORIGINS=*. Remove the wildcard from the
          environment to restrict access here.
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save({
            origins: origins
              .split(/[\n,]/)
              .map((s) => s.trim())
              .filter(Boolean),
          });
        }}
      >
        <label>
          Allowed websites
          <textarea
            aria-label="Allowed websites"
            rows={3}
            placeholder="https://api.github.com"
            value={origins}
            disabled={
              busy || status.allowAllWebsites || status.environmentAllowsAll
            }
            onChange={(e) => setOrigins(e.target.value)}
          />
        </label>
        {(status.allowAllWebsites || status.environmentAllowsAll) && (
          <p className="field-note">
            Your website list is kept for when you turn off unrestricted access.
          </p>
        )}
        {status.environmentOrigins.length > 0 && (
          <p>
            Also allowed by environment: {status.environmentOrigins.join(", ")}
          </p>
        )}
        <button
          className="subtle-button"
          disabled={
            busy || status.allowAllWebsites || status.environmentAllowsAll
          }
        >
          Save website access
        </button>
      </form>
      <h4>API credentials</h4>
      <p>
        Credentials stay in a private local settings file. Workflows and exports
        contain only their names. Each saved credential is restricted to its
        website.
      </p>
      {status.secrets.map((s) => (
        <div className="integration-secret" key={s.name}>
          <span>
            <strong>{s.name}</strong> · {s.origin}
          </span>
          <button disabled={busy} onClick={() => void save({ remove: s.name })}>
            Remove {s.name}
          </button>
        </div>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save({ secret: { name, origin, value } });
        }}
      >
        <label>
          Credential name
          <input
            aria-label="Credential name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            pattern="[A-Z][A-Z0-9_]{1,79}"
          />
        </label>
        <label>
          Credential website
          <input
            aria-label="Credential website"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            required
            type="url"
          />
        </label>
        <label>
          Token
          <input
            aria-label="API credential token"
            type="password"
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
        </label>
        <button className="subtle-button" disabled={busy || !value}>
          Save credential
        </button>
      </form>
    </section>
  );
}
