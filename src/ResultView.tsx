import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, Download, Code2, FileText } from "lucide-react";
import { download } from "./api";
function ReadableText({ text }: { text: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noreferrer">
            {children}
          </a>
        ),
        img: ({ alt }) => (
          <span className="output-image-placeholder">
            [Image: {alt || "external image"}]
          </span>
        ),
      }}
    >
      {text}
    </Markdown>
  );
}
function StructuredOutput({
  value,
}: {
  value: Record<string, unknown> | unknown[];
}) {
  return (
    <div className="structured-output">
      {Object.entries(value).map(([key, item]) => (
        <section className="result-field" key={key}>
          <h4>
            {key.replace(/[_-]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2")}
          </h4>
          {typeof item === "string" ? (
            <div className="markdown-output">
              <ReadableText text={item} />
            </div>
          ) : item !== null && typeof item === "object" ? (
            <details>
              <summary>
                {Array.isArray(item)
                  ? `${item.length} items`
                  : `${Object.keys(item).length} fields`}{" "}
                · expand details
              </summary>
              <pre>{JSON.stringify(item, null, 2)}</pre>
            </details>
          ) : (
            <p>{item === null ? "—" : String(item)}</p>
          )}
        </section>
      ))}
    </div>
  );
}
export function ResultView({
  value,
  name = "result",
}: {
  value: unknown;
  name?: string;
}) {
  const [raw, setRaw] = useState(false),
    [copied, setCopied] = useState(false),
    [error, setError] = useState("");
  let content = value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(
        value
          .trim()
          .replace(/^```(?:json)?\s*/, "")
          .replace(/\s*```$/, ""),
      );
      if (parsed !== null && typeof parsed === "object") content = parsed;
    } catch {}
  }
  const isText = typeof content === "string",
    text =
      typeof content === "string" ? content : JSON.stringify(content, null, 2);
  if (value === undefined) return null;
  return (
    <div className="result-view">
      <div className="result-toolbar">
        <span>{isText ? "Workflow output" : "Structured output"}</span>
        <button
          title={raw ? "Read output" : "View source"}
          aria-label={raw ? "Read output" : "View output source"}
          onClick={() => setRaw((v) => !v)}
        >
          {raw ? <FileText size={13} /> : <Code2 size={13} />}
        </button>
        <button
          title="Copy output"
          aria-label="Copy output"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            } catch {
              setError("Clipboard unavailable. Download the output instead.");
            }
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
        <button
          title="Download output"
          aria-label="Download output"
          onClick={() =>
            download(
              `${name}.${isText ? "md" : "json"}`,
              text,
              isText ? "text/markdown" : "application/json",
            )
          }
        >
          <Download size={13} />
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {raw ? (
        <pre>{text}</pre>
      ) : isText ? (
        <div className="markdown-output">
          <ReadableText text={text} />
        </div>
      ) : content !== null &&
        typeof content === "object" &&
        (content as Record<string, unknown>).type === "browser" ? (
        <div className="browser-result">
          <strong>
            {(content as Record<string, unknown>).needsReview
              ? "Ready for your review"
              : "Browser task result"}
          </strong>
          <div className="markdown-output">
            <ReadableText
              text={String((content as Record<string, unknown>).summary || "")}
            />
          </div>
          {typeof (content as Record<string, unknown>).screenshot ===
            "string" &&
            /^[a-zA-Z0-9_-]+\.png$/.test(
              String((content as Record<string, unknown>).screenshot),
            ) && (
              <a
                href={`/api/artifacts/${(content as Record<string, unknown>).screenshot}`}
                download
              >
                Download browser screenshot
              </a>
            )}
          <p>Open this workflow's browser step to review its saved session.</p>
        </div>
      ) : content !== null && typeof content === "object" ? (
        <StructuredOutput value={content as Record<string, unknown>} />
      ) : (
        <pre>{text}</pre>
      )}
    </div>
  );
}
