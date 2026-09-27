import { skillInstructions } from "./skills";
import type { SkillBundle } from "../shared/automation";
import { spawn } from "node:child_process";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { Provider } from "../shared/schema";
export const dataDir = path.resolve(process.env.JEEVES_DATA_DIR || ".jeeves");
export function capabilities() {
  return {
    typesafe: !!process.env.TYPESAFE_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY,
    local: !!process.env.LOCAL_MODEL,
    codex: process.env.ENABLE_CODEX === "true",
    models: {
      openai: process.env.OPENAI_MODEL || "gpt-6-astra",
      openrouter: process.env.OPENROUTER_MODEL || "",
      local: process.env.LOCAL_MODEL || "",
      codex: process.env.CODEX_MODEL || "",
    },
  };
}
export async function generate(
  provider: Provider,
  model: string,
  instructions: string,
  input: string,
  signal: AbortSignal,
  taskId: string,
  skills: SkillBundle[] = [],
  images: string[] = [],
): Promise<string> {
  signal.throwIfAborted();
  if (!capabilities()[provider])
    throw new Error(
      `${provider} is not configured. See .env.example or use Demo mode.`,
    );
  if (provider === "codex") {
    const dir = path.join(dataDir, "workspaces", taskId);
    await mkdir(dir, { recursive: true });
    instructions += "\n\n" + (await skillInstructions(skills, dir));
    const output = path.join(dir, "result.md");
    const args = [
      "exec",
      "--ignore-user-config",
      "--skip-git-repo-check",
      "--ephemeral",
      "--sandbox",
      "read-only",
      "-C",
      dir,
      "--output-last-message",
      output,
    ];
    const codexModel = model || process.env.CODEX_MODEL;
    if (codexModel) args.push("--model", codexModel);
    for (const file of images) args.push("--image", file);
    args.push("-");
    await new Promise<void>((resolve, reject) => {
      const child = spawn("codex", args, {
        stdio: ["pipe", "ignore", "pipe"],
        signal,
      });
      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr = (stderr + chunk).slice(-2000);
      });
      child.on("error", reject);
      child.stdin.on("error", () => {});
      child.on("close", (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`Codex exited ${code}: ${stderr}`)),
      );
      child.stdin.end(`${instructions}\n\nContext:\n${input}`);
    });
    return readFile(output, "utf8");
  }
  instructions += "\n\n" + (await skillInstructions(skills));
  const selectedModel = model || capabilities().models[provider];
  if (!selectedModel)
    throw new Error(`Set a model for ${provider} on this node or in .env.`);
  const openai = provider === "openai";
  const base =
    provider === "local"
      ? (process.env.LOCAL_BASE_URL || "http://127.0.0.1:11434/v1").replace(
          /\/$/,
          "",
        )
      : "https://openrouter.ai/api/v1";
  const key = openai
    ? process.env.OPENAI_API_KEY
    : provider === "openrouter"
      ? process.env.OPENROUTER_API_KEY
      : process.env.LOCAL_API_KEY;
  const response = await fetch(
    openai ? "https://api.openai.com/v1/responses" : `${base}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify(
        openai
          ? { model: selectedModel, instructions, input, store: false }
          : {
              model: selectedModel,
              messages: [
                { role: "system", content: instructions },
                { role: "user", content: input },
              ],
            },
      ),
      signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]),
    },
  );
  if (!response.ok)
    throw new Error(
      `${provider} returned HTTP ${response.status}. Check the model, credentials, and provider limits.`,
    );
  const json = (await response.json()) as {
    status?: string;
    output?: { content?: { type: string; text?: string }[] }[];
    choices?: { message?: { content?: string } }[];
  };
  if (openai && json.status && json.status !== "completed")
    throw new Error(
      `OpenAI response was ${json.status}; node did not complete.`,
    );
  const text = openai
    ? json.output
        ?.flatMap((item) => item.content || [])
        .filter((item) => item.type === "output_text")
        .map((item) => item.text || "")
        .join("\n")
    : json.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${provider} returned no text.`);
  return text;
}
