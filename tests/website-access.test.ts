import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  saveIntegrations,
  integrationStatus,
  loadIntegrations,
  isOriginAllowed,
  actionToken,
} from "../server/integrations";
import { checkBrowserURL } from "../server/browser";
import { executeHttpAction } from "../server/http-action";
import { makeNode } from "../shared/schema";
import { requirements } from "../server/packages";
import { blank } from "../shared/templates";

beforeEach(async () => {
  vi.stubEnv("ACTION_ALLOWED_ORIGINS", "");
  await saveIntegrations({
    origins: [],
    allowAllWebsites: false,
    remove: "SCOPED_TEST",
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it("persists unrestricted website access and restores the allowlist when disabled", async () => {
  await saveIntegrations({ addOrigin: "https://api.github.com" });
  expect(isOriginAllowed("https://elsewhere.example")).toBe(false);
  await saveIntegrations({ allowAllWebsites: true });
  await loadIntegrations();
  expect(integrationStatus().allowAllWebsites).toBe(true);
  expect(isOriginAllowed("https://elsewhere.example")).toBe(true);
  expect(checkBrowserURL("https://store.example/cart")).toBe(
    "https://store.example/cart",
  );
  expect(isOriginAllowed("file:///etc/hosts")).toBe(false);
  expect(() =>
    checkBrowserURL("https://user:password@store.example"),
  ).toThrow();
  await saveIntegrations({ allowAllWebsites: false });
  expect(isOriginAllowed("https://elsewhere.example")).toBe(false);
  expect(isOriginAllowed("https://api.github.com")).toBe(true);
});
it("supports the environment wildcard for portable runners", () => {
  vi.stubEnv("ACTION_ALLOWED_ORIGINS", "*");
  expect(integrationStatus().environmentAllowsAll).toBe(true);
  expect(isOriginAllowed("https://api.github.com")).toBe(true);
  expect(isOriginAllowed("javascript:alert(1)")).toBe(false);
});
it("permits an HTTP request and clears preflight origin requirements after enabling all", async () => {
  const node = makeNode("action", "read", 0, 0, {
    url: "https://api.github.com/repos/example/project/issues",
  });
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(Response.json([{ title: "Synthetic issue" }]));
  await expect(
    executeHttpAction(node.data, {}, new AbortController().signal),
  ).rejects.toThrow("Allow https://api.github.com");
  expect(fetch).not.toHaveBeenCalled();
  await saveIntegrations({ allowAllWebsites: true });
  expect(
    requirements({ test: { ...blank, nodes: [...blank.nodes, node] } }).missing,
  ).not.toContain("Allow action origin https://api.github.com");
  expect(
    (await executeHttpAction(node.data, {}, new AbortController().signal))
      .output,
  ).toEqual([{ title: "Synthetic issue" }]);
});
it("keeps credential scoping when all sites are allowed and adds origins atomically", async () => {
  await saveIntegrations({
    allowAllWebsites: true,
    secret: {
      name: "SCOPED_TEST",
      origin: "https://api.github.com",
      value: "test-value",
    },
  });
  expect(() => actionToken("SCOPED_TEST", "https://elsewhere.example")).toThrow(
    "scoped",
  );
  expect(actionToken("SCOPED_TEST", "https://api.github.com")).toBe(
    "test-value",
  );
  await Promise.all([
    saveIntegrations({ addOrigin: "https://one.example" }),
    saveIntegrations({ addOrigin: "https://two.example" }),
  ]);
  expect(integrationStatus().origins).toEqual(
    expect.arrayContaining(["https://one.example", "https://two.example"]),
  );
  expect(JSON.stringify(integrationStatus())).not.toContain("test-value");
});
