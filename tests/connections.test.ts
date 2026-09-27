import { afterEach, describe, expect, it, vi } from "vitest";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { saveConnection, checkConnection } from "../server/connections";
import { dataDir } from "../server/providers";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe("local connection management", () => {
  it("stores credentials privately and returns only configuration status", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const result = await saveConnection({
      provider: "openai",
      apiKey: "fixture-secret-do-not-return",
      model: "test-model",
    });
    expect(result.openai).toBe(true);
    expect(JSON.stringify(result)).not.toContain("fixture-secret");
    const file = path.join(dataDir, "connections.json");
    expect(JSON.parse(await readFile(file, "utf8")).OPENAI_API_KEY).toBe(
      "fixture-secret-do-not-return",
    );
    expect((await stat(file)).mode & 0o777).toBe(0o600);
  });
  it("serializes concurrent updates without losing a provider", async () => {
    await Promise.all([
      saveConnection({ provider: "typesafe", apiKey: "jev-test-key" }),
      saveConnection({ provider: "openrouter", apiKey: "router-test-key" }),
    ]);
    const stored = JSON.parse(
      await readFile(path.join(dataDir, "connections.json"), "utf8"),
    );
    expect(stored.TYPESAFE_API_KEY).toBe("jev-test-key");
    expect(stored.OPENROUTER_API_KEY).toBe("router-test-key");
  });
  it("verifies authentication with a non-generative endpoint and handles rejection", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test");
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: "available-model" }] })),
      )
      .mockResolvedValueOnce(new Response("", { status: 401 }));
    const ok = await checkConnection("openai");
    expect(ok.ok).toBe(true);
    expect(ok.models).toEqual(["available-model"]);
    expect(fetch.mock.calls[0][0]).toBe("https://api.openai.com/v1/models");
    const bad = await checkConnection("openai");
    expect(bad.ok).toBe(false);
    expect(bad.detail).toContain("401");
  });
});
