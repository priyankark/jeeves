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
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Workflows", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Open Research to brief", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Open Research to brief", exact: true })
    .click();
  expect(
    (await (await request.get(`/api/runs/${waiting.id}`)).json()).status,
  ).toBe("waiting");

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

test("an input request chimes once when enabled and stays paused after reading the alert", async ({
  page,
  request,
}) => {
  const w = workflow("input-sound-wait");
  await request.put(`/api/workflows/${w.id}`, { data: w });
  await page.addInitScript((id) => {
    localStorage.setItem("jeeves-workflow", id);
    localStorage.setItem(
      "jeeves-notifications",
      JSON.stringify({ sound: true, desktop: false }),
    );
    (window as any).playedTones = 0;
    (window as any).AudioContext = class {
      currentTime = 0;
      destination = {};
      resume() {
        return Promise.resolve();
      }
      createOscillator() {
        return {
          frequency: { value: 0 },
          connect() {},
          disconnect() {},
          start() {
            (window as any).playedTones++;
          },
          stop() {},
        };
      }
      createGain() {
        return {
          gain: {
            setValueAtTime() {},
            linearRampToValueAtTime() {},
            exponentialRampToValueAtTime() {},
          },
          connect() {},
          disconnect() {},
        };
      }
    };
  }, w.id);
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Run workflow", exact: true }).click();
  const form = page.getByRole("form", { name: "Your grocery trip" });
  await expect(form).toBeVisible();
  await expect(form.getByText(/Paused until you submit/)).toBeVisible();
  await expect(
    form.getByLabel("Play a sound when Jeeves needs me"),
  ).toBeChecked();
  await expect
    .poll(() => page.evaluate(() => (window as any).playedTones))
    .toBe(2);
  await page
    .getByRole("button", { name: "Your input is needed", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Provide input", exact: true })
    .click();
  const waiting = (
    await (await request.get("/api/input-requests")).json()
  ).find((r: any) => r.workflowId === w.id);
  expect(waiting.nodes.output.status).toBe("pending");
  await form.getByLabel("Play a sound when Jeeves needs me").uncheck();
  await page.waitForTimeout(1800); // Another notification poll must not chime or advance the run.
  expect(await page.evaluate(() => (window as any).playedTones)).toBe(2);
  expect(
    (await (await request.get(`/api/runs/${waiting.id}`)).json()).status,
  ).toBe("waiting");
  await request.post(`/api/runs/${waiting.id}/cancel`);
});

test("browser review presents a blocking action form and opening the browser does not resume it", async ({
  page,
  request,
}) => {
  const w = workflow("browser-review-ui");
  w.nodes[1] = makeNode("browser", "ask", 330, 0, {
    label: "Shop Amazon Fresh",
    url: "https://www.amazon.com",
    prompt: "Internal agent instructions should not replace the blocker.",
  });
  await request.put(`/api/workflows/${w.id}`, { data: w });
  const run: any = {
    id: "browser-review-run",
    workflowId: w.id,
    workflowName: w.name,
    workflow: w,
    mode: "live",
    status: "waiting",
    startedAt: new Date().toISOString(),
    events: [],
    nodes: {
      input: { status: "completed" },
      ask: {
        status: "waiting",
        requestId: "review-request",
        output: {
          needsReview: true,
          summary: "Sign in to Amazon before shopping.",
          url: "https://www.amazon.com",
        },
      },
      output: { status: "pending" },
    },
  };
  let opened = 0,
    submitted = 0;
  await page.route("**/api/input-requests", (route) =>
    route.fulfill({ json: run.status === "waiting" ? [run] : [] }),
  );
  await page.route("**/api/runs/browser-review-run", (route) =>
    route.fulfill({ json: run }),
  );
  await page.route(
    "**/api/runs/browser-review-run/browser/ask/open",
    (route) => {
      opened++;
      return route.fulfill({ json: { opened: true } });
    },
  );
  await page.route("**/api/runs/browser-review-run/input/ask", (route) => {
    submitted++;
    expect(route.request().postDataJSON()).toEqual({
      requestId: "review-request",
      answers: { action: "Accept result and finish this step", notes: "" },
    });
    run.status = "completed";
    run.nodes.ask.status = "completed";
    run.nodes.output.status = "completed";
    return route.fulfill({ json: run });
  });
  await page.goto("/#home");
  await page
    .getByRole("button", { name: "Your input is needed", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Provide input", exact: true })
    .click();
  const form = page.getByRole("form", { name: "Shop Amazon Fresh" });
  await expect(
    form.getByText("Sign in to Amazon before shopping."),
  ).toBeVisible();
  await form
    .getByRole("button", { name: "Open browser to take action" })
    .click();
  expect(opened).toBe(1);
  expect(submitted).toBe(0);
  expect(run.status).toBe("waiting");
  await form.getByRole("button", { name: "Submit & continue" }).click();
  expect(submitted).toBe(0);
  await form
    .getByLabel("What should Jeeves do next?", { exact: true })
    .selectOption("Accept result and finish this step");
  await form.getByRole("button", { name: "Submit & continue" }).click();
  await expect(form).not.toBeVisible();
  expect(submitted).toBe(1);
});
