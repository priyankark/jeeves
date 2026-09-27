import {
  TypeSafeClient,
  type Question,
  type EntryType,
} from "@typesafe-ai/sdk";
import { z } from "zod";
import { parseCriteria, type NodeData } from "../shared/schema";
import type { Context } from "./engine";
const probability = z.number().min(0).max(1);
const answerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("noul"), noul: probability }),
  z.object({
    type: z.literal("choice"),
    choice: z.string(),
    confidence: probability,
    probabilities: z.record(z.string(), probability),
  }),
  z.object({
    type: z.literal("score"),
    score: z.number().finite(),
    confidence: probability,
    probabilities: z.record(z.string(), probability),
    legend: z.record(z.string(), z.unknown()),
  }),
]);
export type JevAnswer = z.infer<typeof answerSchema>;
export function routeAnswer(
  data: NodeData,
  raw: unknown,
): { route: string; answer: JevAnswer } {
  const answer = answerSchema.parse(raw);
  if (answer.type !== data.questionType)
    throw new Error("Jev returned a different question type.");
  if (answer.type === "noul")
    return {
      route:
        answer.noul >= data.threshold
          ? "pass"
          : answer.noul <= data.failThreshold
            ? "fail"
            : "review",
      answer,
    };
  const criteria = parseCriteria(data);
  const expected =
    answer.type === "choice"
      ? Object.keys(criteria)
      : (criteria as unknown[]).map((_, i) => String(i));
  if (
    expected.some((key) => !Object.hasOwn(answer.probabilities, key)) ||
    Object.keys(answer.probabilities).some((key) => !expected.includes(key))
  )
    throw new Error("Jev returned probabilities outside the defined criteria.");
  const total = Object.values(answer.probabilities).reduce((a, b) => a + b, 0);
  if (Math.abs(total - 1) > 0.02)
    throw new Error("Jev probabilities do not sum to one.");
  if (answer.type === "choice" && !expected.includes(answer.choice))
    throw new Error("Jev returned an unknown choice.");
  if (
    answer.type === "score" &&
    (answer.score < 0 || answer.score > expected.length - 1)
  )
    throw new Error("Jev score is outside the rubric.");
  if (answer.confidence < data.minConfidence)
    return { route: "review", answer };
  return {
    route:
      answer.type === "choice"
        ? answer.choice
        : answer.score >= data.scoreThreshold
          ? "pass"
          : "fail",
    answer,
  };
}
function simulate(data: NodeData, context: Context): JevAnswer {
  const override =
    context.input && typeof context.input === "object"
      ? (context.input as Record<string, unknown>).demo_jev_value
      : undefined;
  const value = typeof override === "number" ? override : data.demoValue;
  if (data.questionType === "noul")
    return { type: "noul", noul: Math.max(0, Math.min(1, value)) };
  const criteria = parseCriteria(data);
  if (data.questionType === "choice") {
    const options = Object.keys(criteria);
    const chosen = typeof override === "string" ? override : data.demoChoice;
    if (!options.includes(chosen))
      throw new Error("Demo choice must match an option in the criteria.");
    const peak =
      (1 + data.demoConfidence * (options.length - 1)) / options.length;
    return {
      type: "choice",
      choice: chosen,
      confidence: data.demoConfidence,
      probabilities: Object.fromEntries(
        options.map((key) => [
          key,
          key === chosen ? peak : (1 - peak) / (options.length - 1),
        ]),
      ),
    };
  }
  const levels = criteria as unknown[],
    score = Math.max(0, Math.min(levels.length - 1, value));
  return {
    type: "score",
    score,
    confidence: data.demoConfidence,
    legend: Object.fromEntries(levels.map((v, i) => [String(i), v])),
    probabilities: Object.fromEntries(
      levels.map((_, i) => [String(i), Math.max(0, 1 - Math.abs(score - i))]),
    ),
  };
}
export async function decide(
  data: NodeData,
  context: Context,
  mode: "demo" | "live",
  signal: AbortSignal,
) {
  const criteria = parseCriteria(data);
  const question = {
    type: data.questionType,
    instructions: data.question,
    criteria,
  } as Question;
  const start = performance.now();
  let response: {
    model: string;
    answers: { decision: unknown };
    usage: { input_tokens: number; output_tokens: number };
  };
  if (mode === "demo")
    response = {
      model: "demo-fixture",
      answers: { decision: simulate(data, context) },
      usage: { input_tokens: 0, output_tokens: 0 },
    };
  else {
    if (!process.env.TYPESAFE_API_KEY)
      throw new Error("Set TYPESAFE_API_KEY in .env to run Jev decisions.");
    const client = new TypeSafeClient({
      apiKey: process.env.TYPESAFE_API_KEY,
      baseURL: "https://api.typesafe.ai",
      timeout: 15000,
      logLevel: "off",
    });
    response = await client.systemOne(
      {
        model:
          data.jevModel || process.env.TYPESAFE_DEFAULT_MODEL || "jev-latest",
        state: context as unknown as EntryType,
        questions: { decision: question },
      },
      { signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]) },
    );
  }
  const { route, answer } = routeAnswer(data, response.answers.decision);
  return {
    engine: "jev",
    simulated: mode === "demo",
    model: response.model,
    question,
    answer,
    route,
    usage: response.usage,
    latencyMs: Math.round(performance.now() - start),
    context: context.previous,
  };
}
