import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { capabilities, dataDir } from "./providers";
const execFileAsync = promisify(execFile);
export const connectionProvider = z.enum([
  "typesafe",
  "openai",
  "openrouter",
  "local",
  "codex",
]);
export type ConnectionProvider = z.infer<typeof connectionProvider>;
export const connectionInput = z.object({
  provider: connectionProvider,
  apiKey: z.string().max(4096).optional(),
  model: z.string().max(120).optional(),
  baseURL: z.string().url().optional(),
  enabled: z.boolean().optional(),
});
const keyNames: Partial<Record<ConnectionProvider, string>> = {
  typesafe: "TYPESAFE_API_KEY",
  openai: "OPENAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  local: "LOCAL_API_KEY",
};
const modelNames: Record<ConnectionProvider, string> = {
  typesafe: "TYPESAFE_DEFAULT_MODEL",
  openai: "OPENAI_MODEL",
  openrouter: "OPENROUTER_MODEL",
  local: "LOCAL_MODEL",
  codex: "CODEX_MODEL",
};
const allowed = new Set([
  ...Object.values(keyNames),
  ...Object.values(modelNames),
  "LOCAL_BASE_URL",
  "ENABLE_CODEX",
]);
const configFile = path.join(dataDir, "connections.json");
let queue: Promise<unknown> = Promise.resolve();
async function readSettings(): Promise<Record<string, string>> {
  try {
    return z
      .record(z.string(), z.string())
      .parse(JSON.parse(await readFile(configFile, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}
export async function loadConnections() {
  for (const [key, value] of Object.entries(await readSettings()))
    if (allowed.has(key)) process.env[key] = value;
}
export async function saveConnection(raw: unknown) {
  const body = connectionInput.parse(raw);
  const operation = async () => {
    const settings = await readSettings(),
      patch: Record<string, string> = {};
    if (body.apiKey !== undefined) {
      const key = keyNames[body.provider];
      if (!key)
        throw new Error("This provider uses your CLI login, not an API key.");
      if (!body.apiKey.trim()) throw new Error("Enter a non-empty API key.");
      patch[key] = body.apiKey.trim();
    }
    if (body.model !== undefined)
      patch[modelNames[body.provider]] = body.model.trim();
    if (body.provider === "local" && body.baseURL) {
      const url = new URL(body.baseURL);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error("Use an HTTP endpoint without embedded credentials.");
      patch.LOCAL_BASE_URL = body.baseURL.replace(/\/$/, "");
    }
    if (body.provider === "codex")
      patch.ENABLE_CODEX = String(body.enabled ?? true);
    Object.assign(settings, patch);
    await mkdir(dataDir, { recursive: true });
    const temp = configFile + ".tmp";
    await writeFile(temp, JSON.stringify(settings, null, 2), { mode: 0o600 });
    await rename(temp, configFile);
    Object.assign(process.env, patch);
    return capabilities();
  };
  const result = queue.then(operation, operation);
  queue = result;
  return result;
}
export type ConnectionCheck = {
  provider: ConnectionProvider;
  ok: boolean;
  checkedAt: string;
  latencyMs: number;
  detail: string;
  models?: string[];
};
export async function checkConnection(
  provider: ConnectionProvider,
): Promise<ConnectionCheck> {
  const start = performance.now();
  let detail = "";
  let models: string[] | undefined;
  try {
    if (!capabilities()[provider])
      throw new Error("Configure this provider first.");
    if (provider === "codex") {
      const { stdout, stderr } = await execFileAsync(
        "codex",
        ["login", "status"],
        { timeout: 10000, maxBuffer: 10000 },
      );
      const status = (stdout + stderr).trim();
      if (!/logged in/i.test(status))
        throw new Error("Run codex login to connect your account.");
      detail = "Codex CLI is logged in and ready.";
    } else if (provider === "typesafe") {
      const client = new TypeSafeClient({
        apiKey: process.env.TYPESAFE_API_KEY,
        baseURL: "https://api.typesafe.ai",
        logLevel: "off",
        retry: { maxRetries: 0 },
      });
      const list = await client.models.list({
        signal: AbortSignal.timeout(12000),
      });
      models = list.map((m) => m.name);
      detail = `Authenticated · ${models.length} Jev model${models.length === 1 ? "" : "s"} available`;
    } else {
      const base =
        provider === "openai"
          ? "https://api.openai.com/v1"
          : provider === "openrouter"
            ? "https://openrouter.ai/api/v1"
            : (
                process.env.LOCAL_BASE_URL || "http://127.0.0.1:11434/v1"
              ).replace(/\/$/, "");
      const key = process.env[keyNames[provider]!];
      const response = await fetch(
        `${base}/${provider === "openrouter" ? "key" : "models"}`,
        {
          headers: key ? { Authorization: `Bearer ${key}` } : {},
          signal: AbortSignal.timeout(12000),
        },
      );
      if (!response.ok)
        throw new Error(
          `Provider returned HTTP ${response.status}. Check credentials and endpoint.`,
        );
      const json = (await response.json()) as { data?: { id: string }[] };
      if (provider !== "openrouter")
        models = Array.isArray(json.data) ? json.data.map((m) => m.id) : [];
      detail =
        provider === "local"
          ? "Model server reachable."
          : "Provider authenticated.";
    }
    return {
      provider,
      ok: true,
      detail,
      models,
      checkedAt: new Date().toISOString(),
      latencyMs: Math.round(performance.now() - start),
    };
  } catch (error) {
    return {
      provider,
      ok: false,
      detail:
        provider === "typesafe" &&
        typeof (error as { status?: number }).status === "number"
          ? `TypeSafe returned HTTP ${(error as { status: number }).status}. Check your key and account access.`
          : error instanceof Error
            ? error.message
            : "Connection failed.",
      checkedAt: new Date().toISOString(),
      latencyMs: Math.round(performance.now() - start),
    };
  }
}
