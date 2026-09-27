import type { NodeData } from "../shared/schema";
export function DecisionFields({
  data: d,
  onChange: patch,
}: {
  data: NodeData;
  onChange: (patch: Partial<NodeData>) => void;
}) {
  return (
    <>
      <label>
        Decision engine
        <select
          value={d.decisionEngine}
          onChange={(e) =>
            patch({ decisionEngine: e.target.value as "jev" | "rule" })
          }
        >
          <option value="jev">Jev · TypeSafe System One</option>
          <option value="rule">Deterministic rule</option>
        </select>
      </label>
      {d.decisionEngine === "rule" ? (
        <>
          <label>
            Context field
            <input
              value={d.field}
              onChange={(e) => patch({ field: e.target.value })}
            />
          </label>
          <label>
            Condition
            <select
              value={d.operator}
              onChange={(e) =>
                patch({ operator: e.target.value as NodeData["operator"] })
              }
            >
              <option value="equals">Equals</option>
              <option value="contains">Contains</option>
              <option value="greater_than">Greater than</option>
              <option value="exists">Exists</option>
            </select>
          </label>
          {d.operator !== "exists" && (
            <label>
              Compare to
              <input
                value={d.value}
                onChange={(e) => patch({ value: e.target.value })}
              />
            </label>
          )}
          <div className="field-note">
            Exact comparison against <code>input</code>, <code>previous</code>,
            or <code>parents.nodeId.field</code>.
          </div>
        </>
      ) : (
        <>
          <div className="jev-provider">
            <span className="jev-glyph">∵</span>
            <div>
              <strong>Jev makes the judgment.</strong>
              <small>Your graph decides what happens next.</small>
            </div>
          </div>
          <label>
            Question type
            <select
              value={d.questionType}
              onChange={(e) => {
                const type = e.target.value as NodeData["questionType"];
                patch({
                  questionType: type,
                  criteria:
                    type === "choice"
                      ? '{\n  "pass": "Ready to proceed",\n  "fail": "Needs more work"\n}'
                      : type === "score"
                        ? '["Incomplete", "Partially supported", "Ready to use"]'
                        : "{}",
                  demoValue: type === "score" ? 1.8 : 0.9,
                });
              }}
            >
              <option value="noul">Noul · probability of yes</option>
              <option value="choice">Choice · select a route</option>
              <option value="score">Score · evaluate a rubric</option>
            </select>
          </label>
          <label>
            Question for Jev
            <textarea
              rows={4}
              value={d.question}
              onChange={(e) => patch({ question: e.target.value })}
            />
          </label>
          <label>
            {d.questionType === "choice"
              ? "Named options (JSON object)"
              : d.questionType === "score"
                ? "Rubric levels (JSON array)"
                : "Yes / no criteria (optional JSON)"}
            <textarea
              rows={5}
              spellCheck={false}
              value={d.criteria}
              onChange={(e) => patch({ criteria: e.target.value })}
            />
          </label>
          {d.questionType === "noul" ? (
            <div className="field-pair">
              <label>
                Pass at or above
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={d.threshold}
                  onChange={(e) => patch({ threshold: Number(e.target.value) })}
                />
              </label>
              <label>
                Fail at or below
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={d.failThreshold}
                  onChange={(e) =>
                    patch({ failThreshold: Number(e.target.value) })
                  }
                />
              </label>
            </div>
          ) : (
            <>
              <label>
                Minimum confidence
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={d.minConfidence}
                  onChange={(e) =>
                    patch({ minConfidence: Number(e.target.value) })
                  }
                />
              </label>
              {d.questionType === "score" && (
                <label>
                  Pass score at or above
                  <input
                    type="number"
                    min="0"
                    max="9"
                    step="0.1"
                    value={d.scoreThreshold}
                    onChange={(e) =>
                      patch({ scoreThreshold: Number(e.target.value) })
                    }
                  />
                </label>
              )}
            </>
          )}
          <div className="field-note">
            {d.questionType === "noul"
              ? "A probability between the thresholds takes the review branch. Noul has no separate confidence field."
              : "Low confidence takes the review branch. The complete probability distribution stays in the run trace."}{" "}
            Connect every route before running.
          </div>
          <label className="spaced-label">
            Jev model
            <input
              value={d.jevModel}
              onChange={(e) => patch({ jevModel: e.target.value })}
              placeholder="jev-latest"
            />
          </label>
          <details className="demo-settings">
            <summary>Demo fixture</summary>
            <p>
              Explicit test values; no model inference. Run input{" "}
              <code>demo_jev_value</code> overrides this value.
            </p>
            {d.questionType === "choice" ? (
              <label>
                Simulated choice
                <input
                  value={d.demoChoice}
                  onChange={(e) => patch({ demoChoice: e.target.value })}
                />
              </label>
            ) : (
              <label>
                Simulated {d.questionType === "noul" ? "probability" : "score"}
                <input
                  type="number"
                  min="0"
                  max={d.questionType === "noul" ? 1 : 9}
                  step="0.05"
                  value={d.demoValue}
                  onChange={(e) => patch({ demoValue: Number(e.target.value) })}
                />
              </label>
            )}
            {d.questionType !== "noul" && (
              <label>
                Simulated confidence
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={d.demoConfidence}
                  onChange={(e) =>
                    patch({ demoConfidence: Number(e.target.value) })
                  }
                />
              </label>
            )}
          </details>
        </>
      )}
    </>
  );
}
