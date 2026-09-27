import { afterEach, describe, expect, it, vi } from "vitest";
import { makeNode, validateGraph } from "../shared/schema";
import { decide, routeAnswer } from "../server/jev";
import { createRun, executeRun } from "../server/engine";
import { starter } from "../shared/templates";
import { randomUUID } from "node:crypto";
const context = {
  input: { task: "Check research readiness" },
  parents: {},
  previous: "Three supported opportunities",
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe("Jev typed routing", () => {
  const data = makeNode("decision", "jev", 0, 0).data;
  it.each([
    [0.95, "pass"],
    [0.8, "pass"],
    [0.5, "review"],
    [0.2, "fail"],
    [0.05, "fail"],
  ] as const)(
    "routes Noul %s to %s without inventing a confidence field",
    (noul, route) => {
      const result = routeAnswer(data, { type: "noul", noul });
      expect(result.route).toBe(route);
      expect(result.answer).not.toHaveProperty("confidence");
    },
  );
  it("routes Choice by the named option, using confidence separately from probability", () => {
    const choice = {
      ...data,
      questionType: "choice" as const,
      criteria: '{"research":"Explore","code":"Implement"}',
    };
    expect(
      routeAnswer(choice, {
        type: "choice",
        choice: "code",
        confidence: 0.9,
        probabilities: { research: 0.05, code: 0.95 },
      }).route,
    ).toBe("code");
    expect(
      routeAnswer(choice, {
        type: "choice",
        choice: "code",
        confidence: 0.5,
        probabilities: { research: 0.25, code: 0.75 },
      }).route,
    ).toBe("review");
  });
  it("routes Score using both rubric score and confidence", () => {
    const score = {
      ...data,
      questionType: "score" as const,
      criteria: '["Incomplete","Partial","Ready"]',
    };
    const answer = {
      type: "score",
      score: 1.8,
      confidence: 0.8,
      probabilities: { "0": 0, "1": 0.2, "2": 0.8 },
      legend: { "0": "Incomplete", "1": "Partial", "2": "Ready" },
    };
    expect(routeAnswer(score, answer).route).toBe("pass");
    expect(routeAnswer(score, { ...answer, confidence: 0.3 }).route).toBe(
      "review",
    );
    expect(
      routeAnswer(score, {
        ...answer,
        score: 0.8,
        probabilities: { "0": 0.2, "1": 0.8, "2": 0 },
      }).route,
    ).toBe("fail");
  });
  it("rejects malformed probabilities, out-of-schema choices, and missing uncertainty paths", () => {
    expect(() => routeAnswer(data, { type: "noul", noul: 1.2 })).toThrow();
    const choice = {
      ...data,
      questionType: "choice" as const,
      criteria: '{"a":null,"b":null}',
    };
    expect(() =>
      routeAnswer(choice, {
        type: "choice",
        choice: "unexpected",
        confidence: 0.9,
        probabilities: { a: 0.95, b: 0.05 },
      }),
    ).toThrow("unknown choice");
    expect(() =>
      routeAnswer(choice, {
        type: "choice",
        choice: "a",
        confidence: 0.9,
        probabilities: { a: 0.95, b: 0.95 },
      }),
    ).toThrow("sum to one");
    expect(
      validateGraph({
        ...starter,
        edges: starter.edges.filter((e) => e.sourceHandle !== "review"),
      }).join(),
    ).toContain("review");
  });
  it("calls the official System One API with state, typed question and model via the SDK", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-typesafe-key");
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          model: "jev-1.13.0",
          answers: { decision: { type: "noul", noul: 0.93 } },
          usage: { input_tokens: 400, output_tokens: 20 },
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
    const result = await decide(
      data,
      context,
      "live",
      new AbortController().signal,
    );
    expect(result.route).toBe("pass");
    expect(result.simulated).toBe(false);
    expect(result.usage.input_tokens).toBe(400);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "jev-latest",
      state: context,
      questions: { decision: { type: "noul", instructions: data.question } },
    });
  });
  it("never calls a provider for simulated Jev decisions and honors the demo override", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const result = await decide(
      data,
      { ...context, input: { demo_jev_value: 0.5 } },
      "demo",
      new AbortController().signal,
    );
    expect(result.route).toBe("review");
    expect(result.simulated).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses the uncertainty edge during a complete demo workflow", async () => {
    const run = createRun(starter, "demo", randomUUID());
    await executeRun(
      run,
      { demo_jev_value: 0.5 },
      new AbortController().signal,
      undefined,
      async () => {},
    );
    expect(run.status).toBe("completed");
    expect(run.nodes.writer.status).toBe("skipped");
    expect(run.nodes.reviewer.status).toBe("completed");
    expect(run.nodes.gate.output).toMatchObject({
      route: "review",
      answer: { type: "noul", noul: 0.5 },
    });
  });
  it("fails clearly when the TypeSafe key is missing", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    await expect(
      decide(data, context, "live", new AbortController().signal),
    ).rejects.toThrow("TYPESAFE_API_KEY");
  });
});
