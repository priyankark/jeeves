import { useDialogFocus } from "./useDialogFocus";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Download,
  ExternalLink,
  FolderOpen,
  Loader2,
  Search,
  Upload,
  Workflow as WorkflowIcon,
  X,
} from "lucide-react";
import type {
  WorkflowListing,
  WorkflowPackage,
  Requirements,
} from "../shared/packages";
import type { Workflow, Provider } from "../shared/schema";
import { api } from "./api";
export function WorkflowMarket({
  onInstalled,
  onEdit,
  onContribute,
}: {
  onInstalled: (w: Workflow) => void;
  onEdit: (w: Workflow) => void;
  onContribute: () => void;
}) {
  const [items, setItems] = useState<WorkflowListing[]>([]),
    [source, setSource] = useState("Bundled starter collection"),
    [repo, setRepo] = useState(
      () => localStorage.getItem("jeeves-community-repo") || "",
    ),
    [search, setSearch] = useState("");
  const [preview, setPreview] = useState<{
      package: WorkflowPackage;
      requirements: Requirements;
      findings: string[];
    } | null>(null),
    [installed, setInstalled] = useState<Workflow | null>(null),
    [override, setOverride] = useState("keep");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  useDialogFocus(!!preview, () => setPreview(null));
  const work = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  async function connect(value: string) {
    const data = await api<{ source: string; listings: WorkflowListing[] }>(
      `/workflow-marketplace${value ? `?repo=${encodeURIComponent(value)}` : ""}`,
    );
    if (value) localStorage.setItem("jeeves-community-repo", value);
    setItems(data.listings);
    setSource(data.source);
    setPreview(null);
  }
  useEffect(() => {
    void work(() => connect(""));
  }, []);
  const open = (value: typeof preview) => {
    setPreview(value);
    setInstalled(null);
    setOverride("keep");
  };
  return (
    <main className="market-page">
      <header className="home-top">
        <div>
          <span className="eyebrow">BUILT TO BE SHARED</span>
          <strong>Explore workflows</strong>
        </div>
        <button className="subtle-button" onClick={onContribute}>
          <Upload size={16} />
          Contribute a workflow
        </button>
      </header>
      <div className="market-body">
        <section className="market-hero">
          <span className="eyebrow">A HEAD START, ON YOUR TERMS</span>
          <h1>Good workflows deserve to go places.</h1>
          <p>
            Find a starting point, make it yours, and give it back. Browse and
            install locally. No Jeeves account required.
          </p>
        </section>
        <div className="market-controls">
          <div className="search-box">
            <Search size={17} />
            <input
              aria-label="Search workflows"
              placeholder="Search by name, task, or tag…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            className="subtle-button"
            onClick={() => file.current?.click()}
          >
            <FolderOpen size={16} />
            Import package
          </button>
          <input
            hidden
            ref={file}
            type="file"
            accept=".json"
            aria-label="Import workflow package file"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected)
                void work(async () => {
                  if (selected.size > 24_000_000)
                    throw new Error("Package exceeds 24 MB.");
                  const p = JSON.parse(await selected.text());
                  const result = await api<{
                    package: WorkflowPackage;
                    requirements: Requirements;
                    findings: string[];
                  }>("/packages/inspect", {
                    method: "POST",
                    body: JSON.stringify(p),
                  });
                  open(result);
                });
              e.target.value = "";
            }}
          />
        </div>
        <details className="community-sources">
          <summary>Connect a community repository</summary>
          <p>
            Use a public GitHub repository with a{" "}
            <code>jeeves-marketplace.json</code> catalog. Every download is
            pinned to a commit and checked against its catalog checksum.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void work(() => connect(repo.trim()));
            }}
          >
            <label className="sr-only" htmlFor="community-repo">
              Community repository
            </label>
            <input
              id="community-repo"
              placeholder="owner/repository"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
            />
            <button className="primary-button" disabled={busy || !repo.trim()}>
              Connect
            </button>
            <button type="button" onClick={() => void work(() => connect(""))}>
              Show starters
            </button>
          </form>
          <p>
            Start your own collection using a contribution export. Publishing to
            GitHub uses GitHub’s account system; sharing package files does not
            need an account.
          </p>
        </details>
        {error && (
          <div className="home-error" role="alert">
            {error}
            <button onClick={() => setError("")}>Dismiss</button>
          </div>
        )}
        <div className="section-heading">
          <h2>{source}</h2>
          <span>{items.length} workflows</span>
        </div>
        {busy && (
          <p role="status" className="loading-line">
            <Loader2 className="spin" size={17} />
            Loading workflow…
          </p>
        )}
        <div className="workflow-market-grid">
          {items
            .filter((w) =>
              `${w.name} ${w.description} ${w.tags.join(" ")}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .map((w) => (
              <button
                className="market-workflow-card"
                key={w.id}
                disabled={busy}
                onClick={() =>
                  void work(async () =>
                    open(
                      await api("/workflow-marketplace/preview", {
                        method: "POST",
                        body: JSON.stringify({
                          id: w.id,
                          ...(w.source !== "bundled"
                            ? { repo: w.source, commit: w.commit }
                            : {}),
                        }),
                      }),
                    ),
                  )
                }
              >
                <div className="market-card-art">
                  <WorkflowIcon size={25} />
                  <span />
                  <span />
                  <span />
                  <ArrowUpRight size={20} />
                </div>
                <div className="market-card-content">
                  <div className="market-tags">
                    {w.tags.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                  <h3>{w.name}</h3>
                  <p>{w.description}</p>
                  <div className="market-card-footer">
                    <span>
                      {w.nodeCount} steps · {w.license}
                    </span>
                    <span>Preview →</span>
                  </div>
                </div>
              </button>
            ))}
        </div>
        {!busy &&
          !items.some((w) =>
            `${w.name} ${w.description} ${w.tags.join(" ")}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          ) && (
            <div className="automation-empty">
              No workflows match this search. Try another phrase or connect a
              repository.
            </div>
          )}
      </div>
      {preview && (
        <div className="modal-backdrop" onClick={() => setPreview(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Workflow marketplace preview"
            className="modal automation-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">REVIEW BEFORE YOU INSTALL</span>
                <h2>{preview.package.name}</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close workflow preview"
                onClick={() => setPreview(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="automation-content">
              <p>{preview.package.description}</p>
              <div className="plan-facts">
                <span>
                  {Object.keys(preview.package.workflows).length} workflows
                </span>
                <span>{preview.package.skills.length} bundled skills</span>
                <span>{preview.package.license}</span>
                <span>{preview.package.author || "Author not specified"}</span>
              </div>
              <h3>What it does</h3>
              <ol className="workflow-step-list">
                {preview.package.workflows[preview.package.rootId].nodes.map(
                  (n) => (
                    <li key={n.id}>
                      <strong>{n.data.label}</strong>
                      <span>
                        {n.data.kind}
                        {n.data.kind === "agent" || n.data.kind === "browser"
                          ? ` · ${n.data.provider}`
                          : ""}
                      </span>
                    </li>
                  ),
                )}
              </ol>
              {preview.requirements.writes.length > 0 && (
                <div className="automation-confirm">
                  <strong>External actions on a live run</strong>
                  {preview.requirements.writes.map((w) => (
                    <p key={w}>{w}</p>
                  ))}
                </div>
              )}
              <p className="field-note">
                Installation only adds a local copy. Review prompts in the
                editor before running. No models or HTTP actions run during
                installation.
              </p>
              <label>
                Agent provider for your copy
                <select
                  value={override}
                  onChange={(e) => setOverride(e.target.value)}
                >
                  <option value="keep">Keep the author’s providers</option>
                  <option value="codex">Use Codex CLI</option>
                  <option value="openai">Use OpenAI</option>
                  <option value="openrouter">Use OpenRouter</option>
                  <option value="local">Use a local model</option>
                </select>
              </label>
              <details>
                <summary>Inspect complete package</summary>
                <pre className="package-json">
                  {JSON.stringify(preview.package, null, 2)}
                </pre>
              </details>
              {preview.findings.length > 0 && (
                <p role="alert" className="automation-error">
                  Possible credentials were found in this package. Ask the
                  author to remove them.
                </p>
              )}
              {installed ? (
                <>
                  <p className="automation-notice" role="status">
                    Added to your local library.
                  </p>
                  <button
                    className="primary-button"
                    onClick={() => onEdit(installed)}
                  >
                    Open workflow <ArrowUpRight size={16} />
                  </button>
                </>
              ) : (
                <button
                  className="primary-button"
                  disabled={busy || preview.findings.length > 0}
                  onClick={() =>
                    void work(async () => {
                      const p = structuredClone(preview.package);
                      if (override !== "keep")
                        for (const w of Object.values(p.workflows))
                          for (const n of w.nodes)
                            if (
                              n.data.kind === "agent" ||
                              n.data.kind === "browser"
                            ) {
                              n.data.provider = override as Provider;
                              n.data.model = "";
                            }
                      const w = await api<Workflow>("/packages/import", {
                        method: "POST",
                        body: JSON.stringify(p),
                      });
                      setInstalled(w);
                      onInstalled(w);
                    })
                  }
                >
                  <Download size={16} />
                  Add to my library
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
