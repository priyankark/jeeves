import { useState } from "react";
import {
  ArrowUpRight,
  ChevronRight,
  Plus,
  Search,
  Workflow as WorkflowIcon,
} from "lucide-react";
import type { Workflow } from "../shared/schema";

export function WorkflowLibrary({
  workflows,
  ready,
  busy,
  onOpen,
  onNew,
  onExplore,
}: {
  workflows: Workflow[];
  ready: boolean;
  busy: boolean;
  onOpen: (workflow: Workflow) => void;
  onNew: () => void;
  onExplore: () => void;
}) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase();
  const shown = workflows
    .filter((w) =>
      `${w.name} ${w.description}`.toLocaleLowerCase().includes(query),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <main className="workflow-library" aria-label="Workflow library">
      <header className="home-top">
        <div>
          <span className="eyebrow">YOUR LOCAL LIBRARY</span>
          <h1>Workflows</h1>
          <p>Choose a workflow to open and run.</p>
        </div>
        <button
          className="primary-button"
          disabled={!ready || busy}
          onClick={onNew}
        >
          <Plus size={16} /> New workflow
        </button>
      </header>
      <div className="library-body">
        <div className="library-toolbar">
          <label>
            <Search size={17} />
            <input
              aria-label="Search saved workflows"
              placeholder="Search your workflows…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button className="subtle-button" onClick={onExplore}>
            Explore workflows <ArrowUpRight size={15} />
          </button>
        </div>
        <p className="library-count" role="status">
          {!ready
            ? "Loading your workflows…"
            : `${shown.length} ${shown.length === 1 ? "workflow" : "workflows"}${query ? ` matching “${search.trim()}”` : " saved on this device"}`}
        </p>
        {busy && (
          <p className="field-note">
            A workflow is running. You can open another when it finishes.
          </p>
        )}
        <ul className="library-list">
          {shown.map((w) => (
            <li key={w.id}>
              <button
                disabled={!ready || busy}
                aria-label={`Open ${w.name}`}
                onClick={() => onOpen(w)}
              >
                <span className="library-icon">
                  <WorkflowIcon size={22} />
                </span>
                <span className="library-details">
                  <strong>{w.name}</strong>
                  <span>{w.description || "No description yet."}</span>
                  <small>
                    {w.nodes.length} steps
                    {w.nodes.some((n) => n.data.kind === "browser")
                      ? " · Browser automation"
                      : ""}
                    {w.nodes.some((n) => n.data.kind === "decision")
                      ? " · Decisions"
                      : ""}
                  </small>
                </span>
                <ChevronRight size={18} />
              </button>
            </li>
          ))}
        </ul>
        {ready && !shown.length && (
          <div className="library-empty">
            <h2>{query ? "No matching workflows" : "Your library is ready"}</h2>
            <p>
              {query
                ? "Try a different name or clear the search."
                : "Create a workflow or add one from Explore."}
            </p>
            {query && (
              <button onClick={() => setSearch("")}>Clear search</button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
