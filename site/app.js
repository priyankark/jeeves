const examples = {
  urgent: {
    request: "“Nobody can sign in. Every login returns an error.”",
    decision: "Urgent · a concrete outage",
    result:
      "Jeeves sends the request to the incident specialist. A draft comes back for your review.",
  },
  routine: {
    request: "“The settings tooltip has a typo. Everything else works.”",
    decision: "Routine · a specific, nonblocking fix",
    result:
      "Jeeves asks the response specialist for a useful reply and a clear next step.",
  },
  needs_information: {
    request: "“Something is wrong. Please sort it out.”",
    decision: "Needs information · ask before assuming",
    result:
      "Jeeves pauses, collects your clarification, and waits until you submit it. Then the work continues.",
  },
};
for (const button of document.querySelectorAll("[data-case]"))
  button.addEventListener("click", () => {
    const key = button.dataset.case,
      example = examples[key];
    for (const b of document.querySelectorAll("[data-case]"))
      b.setAttribute("aria-pressed", String(b === button));
    for (const route of document.querySelectorAll("[data-route]"))
      route.classList.toggle("active", route.dataset.route === key);
    document.querySelector("#example-request").textContent = example.request;
    document.querySelector("#decision-label").textContent = example.decision;
    document.querySelector("#example-result").textContent = example.result;
  });
