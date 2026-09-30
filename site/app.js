const views = {
  input: {
    kicker: "YOUR INPUT",
    heading: "Start with what you have.",
    description:
      "A few rough notes are enough for this example. Review the input before the workflow starts.",
    alt: "Jeeves weekly update input form with sample project notes",
    width: 783,
    height: 759,
  },
  canvas: {
    kicker: "YOUR PROCESS",
    heading: "See how the work gets done.",
    description:
      "This workflow drafts an update, checks it against your notes, and returns the result. Open the editor to change the steps.",
    alt: "Actual Jeeves canvas: project notes, draft the update, check the facts, weekly update",
    width: 1440,
    height: 694,
  },
  result: {
    kicker: "YOUR RESULT",
    heading: "Read it. Then make it yours.",
    description:
      "Review progress, blockers, and next steps in one place. Copy or download the result. Next week, reuse the workflow with fresh notes.",
    alt: "Jeeves sample weekly update with progress, blockers, and next steps",
    width: 783,
    height: 729,
  },
};
for (const button of document.querySelectorAll("[data-view]")) {
  button.addEventListener("click", () => {
    const key = button.dataset.view;
    const view = views[key];
    for (const other of document.querySelectorAll("[data-view]"))
      other.setAttribute("aria-pressed", String(other === button));
    document.querySelector("#example-kicker").textContent = view.kicker;
    document.querySelector("#example-heading").textContent = view.heading;
    document.querySelector("#example-description").textContent =
      view.description;
    const image = document.querySelector("#example-image");
    image.src = `/media/weekly-${key}.png`;
    image.alt = view.alt;
    image.width = view.width;
    image.height = view.height;
    image.parentElement.href = image.src;
    document
      .querySelector(".example-viewer")
      .classList.toggle("show-canvas", key === "canvas");
  });
}
