import { beforeAll, afterAll, it, expect } from "vitest";
import { createServer } from "node:http";
import { executeHttpAction } from "../server/http-action";
import { makeNode } from "../shared/schema";
import { saveIntegrations } from "../server/integrations";
const requests: { path: string; token?: string }[] = [];
const server = createServer((req, res) => {
  const url = new URL(req.url!, "http://localhost");
  requests.push({ path: req.url!, token: req.headers.authorization });
  const n = Number(url.searchParams.get("page") || 1);
  res.setHeader("Content-Type", "application/json");
  if (url.pathname === "/loop") res.setHeader("Link", '</loop>; rel="next"');
  else if (url.pathname === "/offsite")
    res.setHeader("Link", '<http://localhost:1/leak>; rel="next"');
  else if (url.pathname === "/embedded")
    res.setHeader(
      "Link",
      `<${origin.replace("http://", "http://user:password@")}/pages?page=2>; rel="next"`,
    );
  else if (url.pathname === "/pages" && n < 3)
    res.setHeader(
      "Link",
      `</pages?page=${n + 1}>; title="following page"; rel="next", </pages?page=3>; rel="last"`,
    );
  else if (url.pathname === "/limited" && n === 1)
    res.setHeader("Link", '</limited?page=2>; rel="next"');
  if (url.pathname === "/limited" && n === 2) {
    res.statusCode = 429;
    res.setHeader("Retry-After", "45");
    res.end("{}");
    return;
  }
  res.end(
    JSON.stringify(
      url.pathname === "/object" ? { items: [] } : [{ number: n }],
    ),
  );
});
let origin: string;
beforeAll(async () => {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  await saveIntegrations({
    origins: [origin],
    secret: {
      name: "PAGINATION_TOKEN",
      origin,
      value: "fixture-pagination-token",
    },
  });
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));
const data = (endpoint: string, maxPages = 5) =>
  makeNode("action", "read", 0, 0, {
    url: origin + endpoint,
    paginate: true,
    maxPages,
    authEnv: "PAGINATION_TOKEN",
  }).data;
const signal = () => new AbortController().signal;
it("maintainer receives all pages with authentication retained and completion metadata", async () => {
  const before = requests.length;
  const result = await executeHttpAction(data("/pages"), {}, signal());
  expect(result.output).toEqual({
    items: [{ number: 1 }, { number: 2 }, { number: 3 }],
    pagination: { pages: 3, itemCount: 3, truncated: false },
  });
  expect(requests.slice(before)).toHaveLength(3);
  expect(
    requests
      .slice(before)
      .every((r) => r.token === "Bearer fixture-pagination-token"),
  ).toBe(true);
});
it("bounded maintenance run makes partial coverage explicit", async () => {
  const events: string[] = [];
  const result = await executeHttpAction(
    data("/pages", 2),
    {},
    signal(),
    (message) => events.push(message),
  );
  expect(result.output).toMatchObject({
    items: [{ number: 1 }, { number: 2 }],
    pagination: {
      pages: 2,
      itemCount: 2,
      truncated: true,
      next: origin + "/pages?page=3",
    },
  });
  expect(events.at(-1)).toContain("more pages");
});
it.each(["/offsite", "/embedded"])(
  "rejects unsafe next link %s before credentials can leave the original origin",
  async (endpoint) => {
    const before = requests.length;
    await expect(
      executeHttpAction(data(endpoint), {}, signal()),
    ).rejects.toThrow("changes origin or embeds credentials");
    expect(requests.slice(before)).toHaveLength(1);
  },
);
it("a looping Link header cannot fetch the same page repeatedly", async () => {
  const before = requests.length;
  await expect(executeHttpAction(data("/loop"), {}, signal())).rejects.toThrow(
    "repeated pagination",
  );
  expect(requests.slice(before)).toHaveLength(1);
});
it("second-page rate limits identify where retrieval stopped", async () => {
  await expect(
    executeHttpAction(data("/limited"), {}, signal()),
  ).rejects.toThrow(
    "HTTP action returned 429 on page 2. Rate limited. Retry after 45.",
  );
});
it("non-array endpoints get actionable pagination guidance", async () => {
  await expect(
    executeHttpAction(data("/object"), {}, signal()),
  ).rejects.toThrow("Turn off pagination");
});
it("cancellation after a page prevents the next request", async () => {
  const stop = new AbortController(),
    before = requests.length;
  await expect(
    executeHttpAction(data("/pages"), {}, stop.signal, () => stop.abort()),
  ).rejects.toThrow();
  expect(requests.slice(before)).toHaveLength(1);
});
it("single-page actions preserve their existing output shape", async () => {
  const d = data("/pages");
  d.paginate = false;
  const before = requests.length;
  expect((await executeHttpAction(d, {}, signal())).output).toEqual([
    { number: 1 },
  ]);
  expect(requests.slice(before)).toHaveLength(1);
});
