# Jeeves — demo script

Use a clean workspace with synthetic notes and reports. The captured kit screenshots show the real product in an isolated Demo workspace. A recorded Live demo must use a genuinely live run; retain Demo/Live indicators in the footage.

## 90-second edited walkthrough

| Time | Picture | Voiceover |
| --- | --- | --- |
| 00–08 | Orange title card; Jeeves mark | “Good work. In good order. Jeeves is a local-first desktop app for your agent workflows.” |
| 08–22 | Home → choose Meeting notes to actions → enter synthetic notes | “Start with a task. Choose a workflow, describe the work, and review the input before running.” |
| 22–38 | Open the saved workflow; show its connected input, agent, and output | “Give each agent one clear job. The graph makes the steps and their handoffs visible.” |
| 38–55 | Open Bug report triage; show Jev options and connected specialists | “When the next step depends on the task, make that decision explicit. Jev can route an outage, a routine issue, or missing information to the right specialist.” |
| 55–67 | A completed run → Read final output | “Follow progress and inspect the result. Keep missing owners, dates, and evidence visible in the draft.” |
| 67–78 | Skills assignment → Schedules | “Add the skills each agent needs. Schedule recurring work while the local engine is running.” |
| 78–87 | Share / Export → Portable skill | “Export a useful workflow with its runner and requirements, and take it to a compatible harness.” |
| 87–90 | Closing card | “Jeeves. A little direction. A lot done.” |

### On-screen captions

- Opening: “Desktop product preview”.
- Model footage: keep the actual mode visible. If Demo, add “Simulated model responses”.
- Schedule footage: “Requires the local engine to be running”.
- Export footage: “Requires compatible harness, Node.js, credentials, and tools”.
- Closing: “Public availability has not been announced”.

Condense waiting periods with an explicit “Later in the run” transition. Do not imply that a cut-away is a performance benchmark. Do not overlay unmeasured speed or savings claims.

## Five-minute live conversation

**0:00–0:30 — Set context.** Ask which agent task the viewer repeats. Explain local storage and model choice in one sentence. State whether this demonstration uses Demo or Live mode.

**0:30–1:30 — Start from Home.** Select Meeting notes to actions. Enter the sample below. Inspect the task fields before launching. With live input preparation, allow for model latency rather than promising an instant response.

**1:30–2:30 — Read the result.** Look for the actual decisions, actions, missing owners, and missing dates. Open the trace. Explain what went into the agent and what came back.

**2:30–3:30 — Inspect a decision.** Open Bug report triage and show urgent, normal, needs_information, and review. Explain that missing facts are a category and model confidence is a separate signal. If running live, choose one prepared example; do not depend on three live runs fitting this segment.

**3:30–4:20 — Make it reusable.** Show the installed skill on Project status from notes and open schedule setup. Explain engine/sleep behavior. Do not create a recurring schedule solely for the demo unless the viewer wants it.

**4:20–5:00 — Take it along.** Show the export preview and requirements for Portable skill. End by asking which input and review point the viewer would want to change for their own process.

## Synthetic meeting input

```json
{
  "task": "Extract decisions, actions with owners and dates, and open questions.",
  "notes": "Decision: ship accessibility fixes before adding themes. Maya will audit keyboard navigation by Friday. Leo will update onboarding copy; no due date agreed. Investigate offline sync; no owner assigned. Open question: should onboarding include a sample project?"
}
```

## Synthetic triage inputs

**Urgent:** Checkout returns HTTP 500 for every customer. Reproducible in Chrome and Safari. Started after a deployment; the cause is unconfirmed. Expected: successful checkout.

**Normal:** Settings help tooltip says “prefrences”. Settings and checkout work. No customers are blocked. Reproduction: open Settings and hover over the help icon.

**Needs information:** A colleague said something looked wrong. No feature, concrete symptom, reproduction steps, or impact details were supplied.

The repo contains portable packages for the tested workflows under `marketplace/workflows/`.

## Presenter notes

- If a provider is unavailable, label Demo mode clearly and explain that it exercises execution with simulated model responses.
- If a live model produces an unexpected route, inspect it openly. The workflow provides visibility; it does not make model judgments infallible.
- If discussing browser automation, describe its separate Chrome session and manual sign-in/checkout boundaries. Real grocery retailer reliability has not been established by the synthetic tests.
- Do not show Settings with credential-entry fields populated or unrelated personal browser windows.
- The short walkthrough is a script and shot list. This kit does not claim to include a recorded product video.
