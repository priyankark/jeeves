import type { Workflow } from "./schema";
type Node = Workflow["nodes"][number];

export function insertStep(
  workflow: Workflow,
  added: Node,
  selected: string | null,
) {
  const outgoing = (id: string) =>
    workflow.edges.filter((e) => e.source === id);
  const incoming = (id: string) =>
    workflow.edges.filter((e) => e.target === id);
  const anchor = workflow.nodes.find((n) => n.id === selected);
  const linear =
    workflow.edges.length === workflow.nodes.length - 1 &&
    workflow.nodes.every(
      (n) =>
        incoming(n.id).length <= 1 &&
        outgoing(n.id).length <= 1 &&
        n.data.kind !== "decision",
    );
  const candidates = anchor
    ? anchor.data.kind === "output"
      ? incoming(anchor.id)
      : outgoing(anchor.id)
    : linear
      ? incoming(workflow.nodes.find((n) => n.data.kind === "output")?.id || "")
      : [];
  const edge =
    !["input", "output", "decision"].includes(added.data.kind) &&
    candidates.length === 1
      ? candidates[0]
      : undefined;
  if (edge) {
    const source = workflow.nodes.find((n) => n.id === edge.source)!;
    const target = workflow.nodes.find((n) => n.id === edge.target)!;
    const direction = source.data.direction === "left" ? -1 : 1;
    const downstream = new Set([target.id]);
    const queue = [target.id];
    for (let i = 0; i < queue.length; i++)
      for (const e of outgoing(queue[i]))
        if (!downstream.has(e.target)) {
          downstream.add(e.target);
          queue.push(e.target);
        }
    const shift =
      direction *
      Math.max(
        0,
        direction * (source.position.x + direction * 660 - target.position.x),
      );
    const node = {
      ...added,
      position: {
        x: source.position.x + direction * 330,
        y: source.position.y,
      },
      data: { ...added.data, direction: source.data.direction },
    };
    const nodes = workflow.nodes.map((n) =>
      downstream.has(n.id)
        ? { ...n, position: { ...n.position, x: n.position.x + shift } }
        : n,
    );
    nodes.splice(
      nodes.findIndex((n) => n.id === target.id),
      0,
      node,
    );
    return {
      workflow: {
        ...workflow,
        nodes,
        edges: [
          ...workflow.edges.filter((e) => e.id !== edge.id),
          {
            ...edge,
            id: `${added.id}-in`,
            target: added.id,
            targetHandle: undefined,
          },
          {
            id: `${added.id}-out`,
            source: added.id,
            target: edge.target,
            targetHandle: edge.targetHandle,
          },
        ],
      },
      message: `Inserted between ${source.data.label} and ${target.data.label}.`,
    };
  }
  // Ambiguous branches need an explicit connection; place the step in clear space.
  const position = {
    x: Math.max(0, ...workflow.nodes.map((n) => n.position.x)) + 330,
    y: anchor?.position.y || 180,
  };
  return {
    workflow: {
      ...workflow,
      nodes: [...workflow.nodes, { ...added, position }],
    },
    message:
      added.data.kind === "decision"
        ? "Decision added. Connect the input and each decision route."
        : "Step added. Connect its input and output to choose where it runs.",
  };
}

export function executionOrder(workflow: Workflow): Node[] {
  const counts = new Map(workflow.nodes.map((n) => [n.id, 0]));
  for (const edge of workflow.edges)
    counts.set(edge.target, (counts.get(edge.target) || 0) + 1);
  const queue = workflow.nodes.filter((n) => counts.get(n.id) === 0),
    result: Node[] = [];
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i];
    result.push(node);
    for (const edge of workflow.edges.filter((e) => e.source === node.id)) {
      const count = (counts.get(edge.target) || 0) - 1;
      counts.set(edge.target, count);
      if (count === 0) {
        const target = workflow.nodes.find((n) => n.id === edge.target);
        if (target) queue.push(target);
      }
    }
  }
  return result.length === workflow.nodes.length ? result : workflow.nodes;
}
