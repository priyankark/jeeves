import { useState } from "react";
import { Download, ExternalLink, Search, Trash2, Loader2 } from "lucide-react";
import type { Catalog, SkillPreview, SkillSummary } from "../shared/automation";
import { api } from "./api";
import { ResultView } from "./ResultView";
import { SkillPicker } from "./SkillPicker";
const sources = [
  "openai/skills",
  "anthropics/skills",
  "vercel-labs/agent-skills",
];
export function Skills({
  skills,
  reload,
  selected,
  onSelect,
  disabled,
}: {
  skills: SkillSummary[];
  reload: () => Promise<void>;
  selected: string[];
  onSelect: (ids: string[]) => void;
  disabled: boolean;
}) {
  const [tab, setTab] = useState<"installed" | "marketplace">("installed");
  const [repo, setRepo] = useState(sources[0]);
  const [data, setData] = useState<Catalog | null>(null);
  const [preview, setPreview] = useState<SkillPreview | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [remove, setRemove] = useState<SkillSummary | null>(null);
  async function work(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const installed =
    preview &&
    skills.some(
      (s) =>
        s.repo === preview.repo &&
        s.path === preview.path &&
        s.commit === preview.commit,
    );
  return (
    <div className="automation-content">
      <div className="segmented">
        <button
          className={tab === "installed" ? "selected" : ""}
          onClick={() => {
            setTab("installed");
            setPreview(null);
          }}
        >
          Installed ({skills.length})
        </button>
        <button
          className={tab === "marketplace" ? "selected" : ""}
          onClick={() => {
            setTab("marketplace");
            if (!data)
              void work(async () =>
                setData(
                  await api<Catalog>(
                    `/marketplace?repo=${encodeURIComponent(repo)}`,
                  ),
                ),
              );
          }}
        >
          Marketplace
        </button>
      </div>
      {error && (
        <p className="automation-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="automation-notice" role="status">
          {notice}
        </p>
      )}
      {tab === "installed" ? (
        <>
          <h3>Skills for this workflow</h3>
          <p className="field-note">
            Selected skills are shared with the copilot and every agent,
            including nested workflows. Add specialist skills in an agent’s
            Inspector.
          </p>
          <SkillPicker
            skills={skills}
            selected={selected}
            onChange={onSelect}
            disabled={disabled}
          />
          <h3>Manage your library</h3>
          {!skills.length && (
            <div className="automation-empty">
              <Download size={28} />
              <h3>A new capability starts here.</h3>
              <p>
                Browse publisher repositories, review a skill, then install it
                into Jeeves.
              </p>
              <button
                className="primary"
                onClick={() => {
                  setTab("marketplace");
                  void work(async () =>
                    setData(
                      await api<Catalog>(
                        `/marketplace?repo=${encodeURIComponent(repo)}`,
                      ),
                    ),
                  );
                }}
              >
                Browse marketplace
              </button>
            </div>
          )}
          {skills.map((s) => (
            <article className="automation-card" key={s.id}>
              <div>
                <strong>{s.name}</strong>
                <p>{s.description}</p>
                <small>
                  {s.repo} · {s.commit.slice(0, 7)} · {s.fileCount} files
                  {s.hasScripts ? " · Includes scripts" : ""}
                </small>
              </div>
              <button
                className="icon-button"
                disabled={busy}
                aria-label={`Uninstall ${s.name}`}
                onClick={() => setRemove(s)}
              >
                <Trash2 size={17} />
              </button>
            </article>
          ))}
          {remove && (
            <div className="automation-confirm">
              <p>
                Uninstall <strong>{remove.name}</strong>? Existing assignments
                will need to be removed or reinstalled before a new run. Saved
                run checkpoints keep their copy.
              </p>
              <button onClick={() => setRemove(null)}>Keep skill</button>
              <button
                disabled={busy}
                onClick={() =>
                  void work(async () => {
                    await api(`/skills/${remove.id}`, { method: "DELETE" });
                    onSelect(selected.filter((id) => id !== remove.id));
                    setRemove(null);
                    await reload();
                  })
                }
              >
                Uninstall
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="field-note">
            Browse public GitHub skill repositories. Installs are pinned to the
            revision you review; scripts are never run during installation.
          </p>
          <div className="source-shortcuts">
            {sources.map((s) => (
              <button
                disabled={busy}
                key={s}
                onClick={() => {
                  setRepo(s);
                  setPreview(null);
                  void work(async () =>
                    setData(
                      await api<Catalog>(
                        `/marketplace?repo=${encodeURIComponent(s)}`,
                      ),
                    ),
                  );
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <form
            className="marketplace-source"
            onSubmit={(e) => {
              e.preventDefault();
              setPreview(null);
              void work(async () =>
                setData(
                  await api<Catalog>(
                    `/marketplace?repo=${encodeURIComponent(repo.trim())}`,
                  ),
                ),
              );
            }}
          >
            <label>
              GitHub repository
              <input
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="owner/repository"
              />
            </label>
            <button disabled={busy}>Connect</button>
          </form>
          {busy && (
            <p className="loading-line" role="status">
              <Loader2 size={16} className="spin" /> Loading skill data…
            </p>
          )}
          {preview ? (
            <div className="skill-preview">
              <button onClick={() => setPreview(null)}>
                ← Back to results
              </button>
              <div className="preview-heading">
                <div>
                  <h3>{preview.name}</h3>
                  <small>
                    {preview.repo} · {preview.commit.slice(0, 7)}
                  </small>
                </div>
                <a
                  href={`https://github.com/${preview.repo}/tree/${preview.commit}/${preview.path}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View source <ExternalLink size={14} />
                </a>
              </div>
              <p>{preview.description}</p>
              <p className="field-note">
                {preview.fileCount} files ·{" "}
                {preview.license || "No license declared in metadata"}
                {preview.compatibility ? ` · ${preview.compatibility}` : ""}
              </p>
              <p className="field-note">
                Codex receives the complete bundle. OpenAI, OpenRouter, and
                local API agents receive instructions and text references; their
                current harness cannot execute bundled scripts.
              </p>
              <details>
                <summary>Bundled files</summary>
                <ul>
                  {preview.files.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </details>
              <ResultView value={preview.instructions} name="skill-preview" />
              <button
                className="primary"
                disabled={busy || !!installed}
                onClick={() =>
                  void work(async () => {
                    await api("/skills/install", {
                      method: "POST",
                      body: JSON.stringify({
                        repo: preview.repo,
                        path: preview.path,
                        commit: preview.commit,
                      }),
                    });
                    await reload();
                    setNotice(
                      `${preview.name} installed. Assign it from Installed or an agent’s Inspector.`,
                    );
                  })
                }
              >
                <Download size={16} />
                {installed ? "Installed" : "Install reviewed version"}
              </button>
            </div>
          ) : (
            data && (
              <>
                <div className="search-box">
                  <Search size={16} />
                  <input
                    aria-label="Search marketplace"
                    placeholder="Search skills…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <p className="field-note">
                  {data.repo} · {data.skills.length} skills · revision{" "}
                  {data.commit.slice(0, 7)}
                </p>
                <div className="marketplace-grid">
                  {data.skills
                    .filter((s) =>
                      `${s.name} ${s.path}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .map((s) => (
                      <button
                        disabled={busy}
                        key={s.path}
                        onClick={() =>
                          void work(async () =>
                            setPreview(
                              await api<SkillPreview>("/skills/preview", {
                                method: "POST",
                                body: JSON.stringify({
                                  repo: data.repo,
                                  path: s.path,
                                  commit: data.commit,
                                }),
                              }),
                            ),
                          )
                        }
                      >
                        <strong>{s.name}</strong>
                        <small>{s.path || "/"}</small>
                        <span>Review skill →</span>
                      </button>
                    ))}
                </div>
                {!data.skills.length && (
                  <p>No SKILL.md files found in this repository.</p>
                )}
              </>
            )
          )}
        </>
      )}
    </div>
  );
}
