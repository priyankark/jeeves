import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { dataDir } from "./providers";
const originSchema = z
  .string()
  .url()
  .transform((value, ctx) => {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Use an origin only, such as https://api.github.com (no path).",
      });
      return z.NEVER;
    }
    return url.origin;
  });
const secretSchema = z.object({
  name: z.string().regex(/^[A-Z][A-Z0-9_]{1,79}$/),
  origin: originSchema,
  value: z.string().min(1).max(4096),
});
const configSchema = z.object({
  origins: z.array(originSchema).max(100),
  secrets: z.array(secretSchema).max(40),
});
type Config = z.infer<typeof configSchema>;
let settings: Config = { origins: [], secrets: [] };
let writes: Promise<unknown> = Promise.resolve();
const file = path.join(dataDir, "integrations.json");
export async function loadIntegrations() {
  try {
    settings = configSchema.parse(JSON.parse(await readFile(file, "utf8")));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
}
export function allowedOrigins() {
  return [
    ...new Set([
      ...settings.origins,
      ...(process.env.ACTION_ALLOWED_ORIGINS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ]),
  ];
}
export function integrationStatus() {
  return {
    origins: settings.origins,
    environmentOrigins: allowedOrigins().filter(
      (o) => !settings.origins.includes(o),
    ),
    secrets: settings.secrets.map(({ name, origin }) => ({ name, origin })),
  };
}
export async function saveIntegrations(raw: unknown) {
  const body = z
    .object({
      origins: z.array(originSchema).max(100).optional(),
      secret: secretSchema.optional(),
      remove: z.string().optional(),
    })
    .parse(raw);
  const operation = async () => {
    const next = structuredClone(settings);
    if (body.origins) next.origins = body.origins;
    if (body.remove)
      next.secrets = next.secrets.filter((s) => s.name !== body.remove);
    if (body.secret)
      next.secrets = [
        ...next.secrets.filter((s) => s.name !== body.secret!.name),
        body.secret,
      ];
    configSchema.parse(next);
    await mkdir(dataDir, { recursive: true, mode: 0o700 });
    await writeFile(file + ".tmp", JSON.stringify(next, null, 2), {
      mode: 0o600,
    });
    await rename(file + ".tmp", file);
    settings = next;
    return integrationStatus();
  };
  const result = writes.then(operation, operation);
  writes = result.catch(() => {});
  return result;
}
export function actionToken(name: string, origin: string) {
  if (!name) return undefined;
  const secret = settings.secrets.find((s) => s.name === name);
  if (secret && secret.origin !== origin)
    throw new Error(`${name} is scoped to ${secret.origin}, not ${origin}.`);
  const token = secret?.value || process.env[name];
  if (!token)
    throw new Error(
      `Add ${name} for ${origin} in Settings → Websites & API access, or set it in your environment.`,
    );
  return token;
}
export function integrationSecrets() {
  return settings.secrets.map((s) => s.value);
}
