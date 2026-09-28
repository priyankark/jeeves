import { randomUUID } from "node:crypto";
import type { BrowserContext } from "playwright-core";
import type { Workflow } from "../shared/schema";
import type { SkillBundle } from "../shared/automation";
import type { BrowserLogin } from "../shared/browser-login";
import { runBrowserTask, type BrowserPlanner } from "./browser";

type Session = {
  state: BrowserLogin;
  controller: AbortController;
  browser?: BrowserContext;
};
const sessions = new Map<string, Session>();
const active = (s: Session) => ["working", "waiting"].includes(s.state.status);
export function loginStatus(id: string) {
  const session = sessions.get(id);
  if (!session)
    throw new Error("Sign-in session not found. Start sign-in again.");
  return { ...session.state };
}
export function currentLogins() {
  return [...sessions.values()].filter(active).map((s) => ({ ...s.state }));
}
export function startLogin(
  workflow: Workflow,
  nodeId: string,
  input: unknown,
  skills: SkillBundle[],
  planner?: BrowserPlanner,
  visible = true,
) {
  const node = workflow.nodes.find(
    (n) => n.id === nodeId && n.data.kind === "browser",
  );
  if (!node) throw new Error("Browser step not found.");
  const existing = [...sessions.values()].find(
    (s) =>
      active(s) &&
      s.state.workflowId === workflow.id &&
      s.state.nodeId === nodeId,
  );
  if (existing) return { ...existing.state };
  if (currentLogins().length >= 4)
    throw new Error("Close another sign-in session before starting one.");
  for (const [id, s] of sessions)
    if (sessions.size >= 50 && !active(s)) sessions.delete(id);
  const id = randomUUID();
  const session: Session = {
    controller: new AbortController(),
    state: {
      id,
      workflowId: workflow.id,
      nodeId,
      status: "working",
      message:
        "Jeeves is finding sign-in. Wait until it hands the browser to you.",
    },
  };
  sessions.set(id, session);
  const timer = setTimeout(
    () =>
      session.controller.abort(
        new Error(
          "Sign-in navigation timed out. Try opening the browser manually.",
        ),
      ),
    120000,
  );
  void runBrowserTask(
    {
      ...node.data,
      browserMode: "interact",
      browserSteps: 8,
      prompt:
        "Navigate to this website’s sign-in page. Only navigate: do not enter any account details, create accounts, change account settings, or perform the workflow task. When you reach sign-in, MFA, CAPTCHA, an account chooser, or an already signed-in account, return review and hand control to the user. Do not claim authentication succeeded.",
    },
    { input },
    session.controller.signal,
    `login-${id}`,
    `${workflow.id}-${nodeId}`,
    skills,
    (message) => {
      session.state.message = message;
    },
    planner,
    {
      visible,
      loginOnly: true,
      handoff(browser) {
        clearTimeout(timer);
        session.browser = browser;
        session.state.status = "waiting";
        session.state.message =
          "Your turn. Complete sign-in in Chrome, then choose I’m signed in. Jeeves has stopped observing this browser.";
        browser.on("close", () => {
          if (session.state.status === "waiting") {
            session.state.status = "cancelled";
            session.state.message =
              "Browser closed. Any saved session is retained; sign-in was not confirmed.";
          }
        });
      },
    },
  )
    .catch((error) => {
      if (session.state.status !== "cancelled") {
        session.state.status = "failed";
        session.state.message =
          error instanceof Error ? error.message : String(error);
      }
    })
    .finally(() => clearTimeout(timer));
  return { ...session.state };
}
export async function focusLogin(id: string) {
  const session = sessions.get(id);
  if (!session?.browser || session.state.status !== "waiting")
    throw new Error(
      "This sign-in browser is no longer waiting. Start sign-in again.",
    );
  const page = session.browser.pages()[0];
  if (!page)
    throw new Error("The sign-in browser has closed. Start sign-in again.");
  await page.bringToFront();
  return { focused: true };
}
export async function finishLogin(id: string, cancel = false) {
  const session = sessions.get(id);
  if (!session) throw new Error("Sign-in session not found.");
  if (!cancel && session.state.status !== "waiting")
    throw new Error(
      "Wait for Jeeves to hand you the browser before confirming sign-in.",
    );
  session.state.status = cancel ? "cancelled" : "completed";
  session.state.message = cancel
    ? "Sign-in assistance stopped. Existing browser session data was kept."
    : "Browser session saved. You confirmed sign-in; the website will verify access when the workflow runs.";
  session.controller.abort();
  await session.browser?.close();
  return { ...session.state };
}
