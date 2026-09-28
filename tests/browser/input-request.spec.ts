import { test, expect } from "@playwright/test";
import { makeNode, type Workflow } from "../../shared/schema";
import { shoppingInputFields } from "../../shared/input-request";
function workflow(id: string): Workflow {
  return {
    id,
    name: "Shopping input request",
    description: "Collect details before shopping",
    skillIds: [],
    input: "{}",
    nodes: [
      makeNode("input", "input", 0, 0),
      makeNode("user-input", "ask", 330, 0, {
        label: "Your grocery trip",
        prompt: "Tell me what to shop for. I will stop before checkout.",
        inputFields: shoppingInputFields,
      }),
      makeNode("output", "output", 660, 0),
    ],
    edges: [
      { id: "a", source: "input", target: "ask" },
      { id: "b", source: "ask", target: "output" },
    ],
  };
}
test("collects validated answers, saves a draft across reload, recovers through Activity and continues the same run", async ({
  page,
  request,
}) => {
  const w = workflow("input-request-journey");
  await request.put(`/api/workflows/${w.id}`, { data: w });
  await page.addInitScript(
    (id) => localStorage.setItem("jeeves-workflow", id),
    w.id,
  );
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Run workflow", exact: true }).click();
  const form = page.getByRole("form", { name: "Your grocery trip" });
  await expect(form).toBeVisible();
  await form.getByRole("button", { name: "Submit & continue" }).click();
  await expect(
    form.getByText("Please enter groceries and quantities."),
  ).toBeVisible();
  await form
    .getByLabel("Groceries and quantities")
    .fill("2 cartons oat milk\n1 bag oats");
  await form
    .getByLabel("Maximum grocery subtotal ($)", { exact: true })
    .fill("25");
  await form.getByLabel("Delivery ZIP code", { exact: true }).fill("bad");
  await form
    .getByLabel("Allow suitable substitutions", { exact: true })
    .selectOption("false");
  await form.getByRole("button", { name: "Submit & continue" }).click();
  await expect(
    form.getByText("Enter a five-digit ZIP code, or ZIP+4."),
  ).toBeVisible();
  await form.getByLabel("Delivery ZIP code", { exact: true }).fill("02139");
  const waiting = (
    await (await request.get("/api/input-requests")).json()
  ).find((r: any) => r.workflowId === w.id);
  expect(waiting.nodes.output.status).toBe("pending");
  await page.goto("/?reload-input=1#home");
  await page
    .getByRole("button", { name: "Your input is needed", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Provide input", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Expanded workspace panel" }),
  ).toBeVisible();
  await expect(form.getByLabel("Groceries and quantities")).toHaveValue(
    "2 cartons oat milk\n1 bag oats",
  );
  await expect(
    form.getByLabel("Delivery ZIP code", { exact: true }),
  ).toHaveValue("02139");
  await form.getByRole("button", { name: "Submit & continue" }).click();
  await expect(
    page.getByText("Everything connected.", { exact: true }),
  ).toBeVisible();
  const finished = await (await request.get(`/api/runs/${waiting.id}`)).json();
  expect(finished.status).toBe("completed");
  expect(finished.nodes.output.output.budget_usd).toBe(25);
  expect(finished.nodes.output.output.substitutions).toBe(false);
  const duplicate = await request.post(`/api/runs/${waiting.id}/input/ask`, {
    data: { requestId: waiting.nodes.ask.requestId, answers: {} },
  });
  expect(duplicate.status()).toBe(409);
});
test("server rejects invalid answers and concurrent submissions cannot execute twice; cancelled requests cannot resume", async ({
  request,
}) => {
  const w = workflow("input-race");
  const run = await (
    await request.post("/api/runs", {
      data: { workflow: w, mode: "live", input: {} },
    })
  ).json();
  await expect
    .poll(
      async () =>
        (await (await request.get(`/api/runs/${run.id}`)).json()).status,
    )
    .toBe("waiting");
  const waiting = await (await request.get(`/api/runs/${run.id}`)).json();
  const endpoint = `/api/runs/${run.id}/input/ask`;
  expect(
    (
      await request.post(endpoint, {
        data: {
          requestId: waiting.nodes.ask.requestId,
          answers: { budget_usd: 0 },
        },
      })
    ).status(),
  ).toBe(400);
  const body = {
    requestId: waiting.nodes.ask.requestId,
    answers: {
      grocery_list: ["oats"],
      budget_usd: 20,
      delivery_zip: "02139",
      substitutions: false,
    },
  };
  const results = await Promise.all([
    request.post(endpoint, { data: body }),
    request.post(endpoint, { data: body }),
  ]);
  expect(results.map((r) => r.status()).sort()).toEqual([200, 409]);
  const next = await (
    await request.post("/api/runs", {
      data: { workflow: w, mode: "live", input: {} },
    })
  ).json();
  await expect
    .poll(
      async () =>
        (await (await request.get(`/api/runs/${next.id}`)).json()).status,
    )
    .toBe("waiting");
  const r = await (await request.get(`/api/runs/${next.id}`)).json();
  await request.post(`/api/runs/${next.id}/cancel`);
  expect(
    (
      await request.post(`/api/runs/${next.id}/input/ask`, {
        data: { requestId: r.nodes.ask.requestId, answers: body.answers },
      })
    ).status(),
  ).toBe(409);
});
test("workflow authors can add and configure an input step without JSON", async ({
  page,
  request,
}) => {
  const w = workflow("input-designer");
  await request.put(`/api/workflows/${w.id}`, { data: w });
  await page.addInitScript(
    (id) => localStorage.setItem("jeeves-workflow", id),
    w.id,
  );
  await page.goto("/#editor");
  await page.locator(".flow-node.user-input").click();
  await page
    .getByRole("button", { name: "Expand panel to full screen" })
    .click();
  await page
    .getByLabel("Question 1 label", { exact: true })
    .fill("Shopping list");
  await expect(page.getByLabel("Question 1 type", { exact: true })).toHaveValue(
    "list",
  );
  await page.getByRole("button", { name: "Add question", exact: true }).click();
  await page
    .getByLabel("Question 6 label", { exact: true })
    .fill("Preferred brand");
  await expect
    .poll(
      async () =>
        (await (await request.get("/api/workflows")).json())
          .find((v: any) => v.id === w.id)
          .nodes.find((n: any) => n.id === "ask")
          .data.inputFields.at(-1).label,
    )
    .toBe("Preferred brand");
});
