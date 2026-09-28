import { useEffect, useState } from "react";
import { MessageSquare, Plus, Trash2, Loader2 } from "lucide-react";
import type { Run } from "../shared/schema";
import {
  browserReviewFields,
  inputFieldSchema,
  shoppingInputFields,
  validateAnswers,
  type InputField,
} from "../shared/input-request";
import { useAttention, chime } from "./Attention";
import { api, ApiError } from "./api";
import { ReadableText } from "./ResultView";

export function InputFieldEditor({
  fields,
  onChange,
}: {
  fields: InputField[];
  onChange: (fields: InputField[]) => void;
}) {
  const patch = (index: number, value: Partial<InputField>) =>
    onChange(fields.map((f, i) => (i === index ? { ...f, ...value } : f)));
  return (
    <section className="input-field-editor" aria-label="Questions to ask">
      <div className="input-preset">
        <strong>Questions</strong>
        <button
          type="button"
          className="subtle-button"
          onClick={() => onChange(structuredClone(shoppingInputFields))}
        >
          Use grocery questions
        </button>
      </div>
      {fields.map((field, index) => (
        <div className="question-editor" key={index}>
          <div className="input-preset">
            <strong>Question {index + 1}</strong>
            <button
              type="button"
              className="icon-button"
              aria-label={`Remove question ${index + 1}`}
              onClick={() => onChange(fields.filter((_, i) => i !== index))}
            >
              <Trash2 size={15} />
            </button>
          </div>
          <label>
            Question label
            <input
              aria-label={`Question ${index + 1} label`}
              value={field.label}
              onChange={(e) => patch(index, { label: e.target.value })}
            />
          </label>
          <label>
            Answer type
            <select
              aria-label={`Question ${index + 1} type`}
              value={field.type}
              onChange={(e) =>
                patch(index, { type: e.target.value as InputField["type"] })
              }
            >
              <option value="text">Short text</option>
              <option value="longtext">Long text</option>
              <option value="list">List · one item per line</option>
              <option value="number">Number</option>
              <option value="boolean">Yes or no</option>
              <option value="choice">Choose an option</option>
            </select>
          </label>
          <label>
            Help text
            <input
              aria-label={`Question ${index + 1} help`}
              value={field.help}
              onChange={(e) => patch(index, { help: e.target.value })}
            />
          </label>
          <label className="question-required">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => patch(index, { required: e.target.checked })}
            />
            Required answer
          </label>
          {field.type === "choice" && (
            <label>
              Choices · one per line
              <textarea
                value={field.options.join("\n")}
                onChange={(e) =>
                  patch(index, { options: e.target.value.split("\n") })
                }
              />
            </label>
          )}
          {field.type === "number" && (
            <div className="question-bounds">
              {(["min", "max"] as const).map((bound) => (
                <label key={bound}>
                  {bound === "min" ? "Minimum" : "Maximum"}
                  <input
                    type="number"
                    step="any"
                    value={field[bound] ?? ""}
                    onChange={(e) =>
                      patch(index, {
                        [bound]:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      })
                    }
                  />
                </label>
              ))}
            </div>
          )}
          <details>
            <summary>Field settings</summary>
            <label>
              Answer key
              <input
                aria-label={`Question ${index + 1} key`}
                value={field.key}
                onChange={(e) => patch(index, { key: e.target.value })}
              />
            </label>
            {field.type === "text" && (
              <label>
                Format
                <select
                  value={field.format}
                  onChange={(e) =>
                    patch(index, {
                      format: e.target.value as InputField["format"],
                    })
                  }
                >
                  <option value="">Any text</option>
                  <option value="us_zip">US ZIP code</option>
                </select>
              </label>
            )}
          </details>
        </div>
      ))}
      <button
        type="button"
        className="secondary-button"
        disabled={fields.length >= 30}
        onClick={() => {
          let key = `answer_${fields.length + 1}`;
          while (fields.some((f) => f.key === key)) key += "_";
          onChange([
            ...fields,
            inputFieldSchema.parse({
              key,
              label: "Your question",
              type: "text",
            }),
          ]);
        }}
      >
        <Plus size={14} />
        Add question
      </button>
    </section>
  );
}
function RequestForm({
  run,
  nodeId,
  onUpdate,
}: {
  run: Run;
  nodeId: string;
  onUpdate: (run: Run) => void;
}) {
  const node = run.workflow.nodes.find((n) => n.id === nodeId)!;
  const state = run.nodes[nodeId];
  const browserReview = node.data.kind === "browser";
  const fields = browserReview ? browserReviewFields : node.data.inputFields;
  const { preferences, setPreferences } = useAttention();
  const draftKey = `jeeves-answer:${run.id}:${state.requestId}`;
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || "null");
      if (saved && typeof saved === "object" && !Array.isArray(saved))
        return saved;
    } catch {}
    return state.inputDraft || {};
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(values));
    } catch {}
  }, [draftKey, values]);
  const change = (key: string, value: unknown) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    const checked = validateAnswers(fields, values);
    setErrors(checked.errors);
    setError("");
    if (Object.keys(checked.errors).length) {
      const first = Object.keys(checked.errors)[0];
      requestAnimationFrame(() =>
        document.getElementById(`answer-${run.id}-${nodeId}-${first}`)?.focus(),
      );
      return;
    }
    setPending(true);
    try {
      const next = await api<Run>(`/runs/${run.id}/input/${nodeId}`, {
        method: "POST",
        body: JSON.stringify({
          requestId: state.requestId,
          answers: checked.answers,
        }),
      });
      try {
        localStorage.removeItem(draftKey);
      } catch {}
      onUpdate(next);
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.details.fieldErrors)
        setErrors(e.details.fieldErrors as Record<string, string>);
      if (e instanceof ApiError && e.status === 409) {
        try {
          onUpdate(await api<Run>(`/runs/${run.id}`));
        } catch {}
      }
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      className="input-request-form"
      aria-label={node.data.label}
      onSubmit={(e) => void submit(e)}
      noValidate
    >
      <div className="input-request-heading">
        <MessageSquare size={22} />
        <div>
          <span className="eyebrow">YOUR INPUT IS NEEDED</span>
          <h3>{node.data.label}</h3>
        </div>
      </div>
      {browserReview ? (
        <details className="request-findings" open>
          <summary>Browser findings</summary>
          <div
            className="markdown-output request-copy"
            role="region"
            aria-label="Browser findings"
            tabIndex={0}
          >
            <ReadableText
              compactLinks
              text={String(
                (state.output as { summary?: string })?.summary ||
                  "Review the browser before continuing.",
              )}
            />
          </div>
        </details>
      ) : (
        <div className="markdown-output request-copy">
          <ReadableText
            text={
              node.data.prompt ||
              "Answer these questions so the workflow can continue."
            }
          />
        </div>
      )}
      <p className="input-request-note">
        Paused until you submit. No later steps will run while Jeeves waits.
        Your progress is saved, including if you close the app. Return from
        Activity.
      </p>
      <label className="preference-toggle">
        <input
          type="checkbox"
          checked={preferences.sound}
          onChange={(e) => {
            setPreferences({ ...preferences, sound: e.target.checked });
            if (e.target.checked) void chime();
          }}
        />
        Play a sound when Jeeves needs me
      </label>
      {browserReview && (
        <button
          type="button"
          className="secondary-button"
          disabled={pending}
          onClick={async () => {
            setError("");
            try {
              await api(`/runs/${run.id}/browser/${nodeId}/open`, {
                method: "POST",
              });
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Open browser to take action
        </button>
      )}
      <fieldset disabled={pending}>
        {fields.map((field) => {
          const id = `answer-${run.id}-${nodeId}-${field.key}`;
          const common = {
            id,
            "aria-invalid": !!errors[field.key],
            "aria-required": field.required,
            "aria-describedby": `${id}-help ${id}-error`,
          };
          const value = values[field.key];
          return (
            <div className="answer-field" key={field.key}>
              <label htmlFor={id}>
                {field.label}
                {!field.required && <span> (optional)</span>}
              </label>
              {field.type === "boolean" || field.type === "choice" ? (
                <select
                  {...common}
                  value={
                    field.type === "boolean"
                      ? typeof value === "boolean"
                        ? String(value)
                        : ""
                      : typeof value === "string"
                        ? value
                        : ""
                  }
                  onChange={(e) =>
                    change(
                      field.key,
                      field.type === "boolean"
                        ? e.target.value === ""
                          ? undefined
                          : e.target.value === "true"
                        : e.target.value,
                    )
                  }
                >
                  <option value="">Choose…</option>
                  {field.type === "boolean" ? (
                    <>
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </>
                  ) : (
                    field.options.map((option) => (
                      <option key={option}>{option}</option>
                    ))
                  )}
                </select>
              ) : field.type === "list" || field.type === "longtext" ? (
                <textarea
                  {...common}
                  rows={4}
                  value={
                    field.type === "list"
                      ? Array.isArray(value)
                        ? value.join("\n")
                        : ""
                      : typeof value === "string"
                        ? value
                        : ""
                  }
                  onChange={(e) =>
                    change(
                      field.key,
                      field.type === "list"
                        ? e.target.value.split("\n")
                        : e.target.value,
                    )
                  }
                />
              ) : (
                <input
                  {...common}
                  type={field.type === "number" ? "number" : "text"}
                  inputMode={field.format === "us_zip" ? "numeric" : undefined}
                  step="any"
                  min={field.min}
                  max={field.max}
                  value={
                    typeof value === "string" || typeof value === "number"
                      ? value
                      : ""
                  }
                  onChange={(e) =>
                    change(
                      field.key,
                      field.type === "number"
                        ? e.target.value === ""
                          ? ""
                          : Number(e.target.value)
                        : e.target.value,
                    )
                  }
                />
              )}
              <small id={`${id}-help`}>{field.help}</small>
              {errors[field.key] && (
                <span className="answer-error" id={`${id}-error`} role="alert">
                  {errors[field.key]}
                </span>
              )}
            </div>
          );
        })}
      </fieldset>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <div className="request-actions">
        <button className="primary-button" type="submit" disabled={pending}>
          {pending && <Loader2 size={15} className="spin" />}
          {pending ? "Saving answers…" : "Submit & continue"}
        </button>
        <span>Continues this {run.mode} run from the saved step.</span>
      </div>
    </form>
  );
}
export function RunInputRequests({
  run,
  onUpdate,
}: {
  run: Run;
  onUpdate: (run: Run) => void;
}) {
  if (run.status !== "waiting") return null;
  return (
    <div className="run-input-requests">
      {run.workflow.nodes
        .filter(
          (n) =>
            run.nodes[n.id]?.status === "waiting" &&
            ["user-input", "browser"].includes(n.data.kind),
        )
        .map((node) => (
          <RequestForm
            key={`${run.id}:${run.nodes[node.id].requestId}`}
            run={run}
            nodeId={node.id}
            onUpdate={onUpdate}
          />
        ))}
    </div>
  );
}
