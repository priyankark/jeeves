import { useState } from "react";
export function TaskInput({
  value,
  onChange,
  disabled,
  sourceLabel = "Workflow input for chat run",
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  sourceLabel?: string;
}) {
  const [source, setSource] = useState(false);
  let fields: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(value);
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      Object.values(parsed).every(
        (v) =>
          ["string", "number", "boolean"].includes(typeof v) ||
          (Array.isArray(v) && v.every((item) => typeof item === "string")),
      )
    )
      fields = parsed;
  } catch {}
  function update(key: string, next: unknown) {
    onChange(JSON.stringify({ ...fields, [key]: next }, null, 2));
  }
  return (
    <div className="task-input-editor">
      {fields && (
        <button
          type="button"
          className="subtle-button"
          onClick={() => setSource((v) => !v)}
        >
          {source ? "Use task fields" : "Edit JSON"}
        </button>
      )}
      {!source && fields ? (
        <div className="task-fields">
          {Object.entries(fields).map(([key, item]) => (
            <label key={key}>
              <span>
                {key.replace(/[_-]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2")}
              </span>
              {Array.isArray(item) ? (
                <>
                  <textarea
                    aria-label={`Task input: ${key}`}
                    rows={3}
                    value={item.join("\n")}
                    disabled={disabled}
                    onChange={(e) =>
                      update(
                        key,
                        e.target.value ? e.target.value.split("\n") : [],
                      )
                    }
                  />
                  <small className="task-list-hint">
                    One item per line. Include quantities where needed.
                  </small>
                </>
              ) : typeof item === "boolean" ? (
                <input
                  aria-label={`Task input: ${key}`}
                  type="checkbox"
                  checked={item}
                  disabled={disabled}
                  onChange={(e) => update(key, e.target.checked)}
                />
              ) : typeof item === "number" ? (
                <input
                  aria-label={`Task input: ${key}`}
                  type="number"
                  step="any"
                  value={item}
                  disabled={disabled}
                  onChange={(e) => update(key, Number(e.target.value))}
                />
              ) : (
                <textarea
                  aria-label={`Task input: ${key}`}
                  rows={key === "task" ? 3 : 1}
                  value={String(item)}
                  disabled={disabled}
                  onChange={(e) => update(key, e.target.value)}
                />
              )}
            </label>
          ))}
        </div>
      ) : (
        <textarea
          aria-label={sourceLabel}
          rows={5}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
