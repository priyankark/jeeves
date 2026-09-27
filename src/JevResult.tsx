import { GitBranch } from "lucide-react";
type Result = {
  engine: string;
  simulated: boolean;
  route: string;
  model: string;
  latencyMs: number;
  answer: {
    type: string;
    noul?: number;
    score?: number;
    choice?: string;
    confidence?: number;
    probabilities?: Record<string, number>;
  };
};
export function JevResult({ value }: { value: unknown }) {
  if (
    !value ||
    typeof value !== "object" ||
    !("engine" in value) ||
    value.engine !== "jev"
  )
    return null;
  const result = value as Result,
    answer = result.answer;
  const probabilities =
    answer.type === "noul"
      ? { yes: answer.noul!, no: 1 - answer.noul! }
      : answer.probabilities || {};
  return (
    <div className="jev-result">
      <div>
        <span className="jev-glyph">∵</span>
        <strong>Jev · {answer.type}</strong>
        <small>
          {result.simulated ? "Demo fixture" : `${result.latencyMs} ms`}
        </small>
      </div>
      <div className="jev-outcome">
        <span>
          {answer.type === "noul"
            ? "Probability of yes"
            : answer.type === "choice"
              ? "Selected option"
              : "Rubric score"}
        </span>
        <strong>
          {answer.type === "noul"
            ? `${Math.round(answer.noul! * 100)}%`
            : answer.type === "choice"
              ? answer.choice
              : answer.score?.toFixed(2)}
        </strong>
      </div>
      {answer.confidence !== undefined && (
        <div className="jev-confidence">
          Confidence <strong>{Math.round(answer.confidence * 100)}%</strong>
        </div>
      )}
      <div className="probability-bars">
        {Object.entries(probabilities).map(([key, value]) => (
          <div key={key}>
            <span>{key}</span>
            <div>
              <i style={{ width: `${value * 100}%` }} />
            </div>
            <small>{Math.round(value * 100)}%</small>
          </div>
        ))}
      </div>
      <div className="jev-route">
        <GitBranch size={13} /> Routed to <strong>{result.route}</strong>
      </div>
      <footer>{result.model}</footer>
    </div>
  );
}
