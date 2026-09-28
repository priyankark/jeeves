import { useState } from "react";
import { Download, Package, Share2, ShieldCheck } from "lucide-react";
import type { Workflow } from "../shared/schema";
import type { PackagePreview } from "../shared/packages";
import { api } from "./api";
export function ShareWorkflow({
  workflow: current,
  workflows = [],
}: {
  workflow: Workflow;
  workflows?: Workflow[];
}) {
  const [workflow, setWorkflow] = useState(current);
  const [kind, setKind] = useState<"skill" | "workflow" | "contribution">(
      "skill",
    ),
    [author, setAuthor] = useState(""),
    [license, setLicense] = useState("Apache-2.0"),
    [includeInput, setIncludeInput] = useState(false),
    [reviewed, setReviewed] = useState(false);
  const [preview, setPreview] = useState<PackagePreview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const invalidate = () => {
    setPreview(null);
    setReviewed(false);
  };
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
  async function exportFile() {
    if (!preview) return;
    const response = await fetch(`/api/packages/export?kind=${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preview.package),
    });
    if (!response.ok) throw new Error((await response.json()).error);
    const url = URL.createObjectURL(await response.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `${preview.slug}${kind === "workflow" ? ".jeeves.json" : kind === "skill" ? "-skill.zip" : "-contribution.zip"}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="automation-content share-content">
      <label>
        Workflow to share
        <select
          aria-label="Workflow to share"
          value={workflow.id}
          onChange={(e) => {
            const w = workflows.find((w) => w.id === e.target.value);
            if (w) {
              setWorkflow(w.id === current.id ? current : w);
              invalidate();
            }
          }}
        >
          {[...workflows.filter((w) => w.id !== current.id), current].map(
            (w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ),
          )}
        </select>
      </label>
      <p>
        Your workflow can travel with its nested workflows and assigned skills.
        Credentials, connection settings, schedules, conversations, and run
        history stay on this device.
      </p>
      <div className="share-options">
        {(
          [
            [
              "skill",
              "Portable skill",
              "Take it to Codex or another skill-capable harness.",
            ],
            [
              "workflow",
              "Workflow package",
              "Import into another Jeeves workspace.",
            ],
            [
              "contribution",
              "Marketplace contribution",
              "Share a ready-to-review community submission.",
            ],
          ] as const
        ).map(([id, name, desc]) => (
          <button
            aria-pressed={kind === id}
            className={kind === id ? "selected" : ""}
            key={id}
            onClick={() => setKind(id)}
          >
            <Package size={20} />
            <strong>{name}</strong>
            <small>{desc}</small>
          </button>
        ))}
      </div>
      <div className="form-columns">
        <label>
          Author (optional)
          <input
            value={author}
            maxLength={100}
            onChange={(e) => {
              setAuthor(e.target.value);
              invalidate();
            }}
          />
        </label>
        <label>
          Workflow license
          <select
            value={license}
            onChange={(e) => {
              setLicense(e.target.value);
              invalidate();
            }}
          >
            <option value="MIT">MIT</option>
            <option value="Apache-2.0">Apache 2.0</option>
            <option value="CC0-1.0">CC0</option>
            <option value="Private">Private / no redistribution</option>
          </select>
        </label>
      </div>
      <label className="skill-check">
        <input
          type="checkbox"
          checked={includeInput}
          onChange={(e) => {
            setIncludeInput(e.target.checked);
            invalidate();
          }}
        />
        <span>
          Include the current input as an example
          <small>
            Leave off to replace saved task data with a placeholder.
          </small>
        </span>
      </label>
      {error && (
        <p role="alert" className="automation-error">
          {error}
        </p>
      )}
      <button
        disabled={busy}
        onClick={() =>
          void work(async () => {
            setPreview(
              await api<PackagePreview>("/packages/preview", {
                method: "POST",
                body: JSON.stringify({
                  workflow,
                  author,
                  license,
                  includeInput,
                }),
              }),
            );
            setReviewed(false);
          })
        }
      >
        {busy ? "Preparing…" : "Prepare export preview"}
      </button>
      {preview && (
        <section className="export-preview">
          <h3>Review what you’re sharing</h3>
          <div className="plan-facts">
            <span>
              {Object.keys(preview.package.workflows).length} workflows
            </span>
            <span>{preview.package.skills.length} skills</span>
            <span>{Math.ceil(preview.bytes / 1024)} KB of workflow data</span>
          </div>
          <p className="field-note">
            {kind === "skill"
              ? "The ZIP includes SKILL.md, the workflow package, example input, requirements, and a standalone Node runner. No npm install or Jeeves app is required. The harness needs shell access and permission to run it."
              : kind === "contribution"
                ? "The ZIP includes the workflow package, catalog entry with a checksum, and contribution instructions. Send it to a maintainer, or publish it in your own public GitHub repository. Jeeves does not upload anything or require a login."
                : "The JSON package includes complete nested workflows and installed skill resources. Importing never starts a run."}
          </p>
          <h4>Required on the receiving machine</h4>
          <ul>
            {[
              ...preview.requirements.tools,
              ...preview.requirements.variables,
              ...preview.requirements.models,
              ...preview.requirements.origins.map(
                (o) => `Allow HTTP origin: ${o}`,
              ),
            ].map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {preview.findings.length > 0 ? (
            <div className="automation-error">
              Possible embedded credentials found. Remove them from these
              locations before exporting:
              <ul>
                {preview.findings.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="privacy-check">
              <ShieldCheck size={15} />
              No known credential patterns detected. Review prompts and URLs for
              private information.
            </p>
          )}
          <details>
            <summary>Inspect complete workflow package</summary>
            <pre className="package-json">
              {JSON.stringify(preview.package, null, 2)}
            </pre>
          </details>
          <label className="skill-check">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            <span>
              I reviewed the included content and have permission to share any
              bundled skills.
            </span>
          </label>
          <button
            className="primary-button"
            disabled={
              busy ||
              !reviewed ||
              preview.findings.length > 0 ||
              (kind === "contribution" && license === "Private")
            }
            onClick={() => void work(exportFile)}
          >
            <Download size={16} />
            Download{" "}
            {kind === "skill"
              ? "skill"
              : kind === "workflow"
                ? "workflow package"
                : "contribution"}
          </button>
        </section>
      )}
    </div>
  );
}
