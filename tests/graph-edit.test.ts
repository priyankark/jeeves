import { describe, expect, it } from "vitest";
import { insertStep, executionOrder } from "../shared/graph-edit";
import { blank, starter } from "../shared/templates";
import { makeNode, validateGraph } from "../shared/schema";

describe("editing a workflow", () => {
  it("inserts an agent into a fresh workflow without a bypass or overlap", () => {
    const original = structuredClone(blank);
    const result = insertStep(
      blank,
      makeNode("agent", "summarize", 0, 0),
      null,
    ).workflow;
    expect(result.edges.map((e) => [e.source, e.target])).toEqual([
      ["input", "summarize"],
      ["summarize", "output"],
    ]);
    expect(result.nodes.map((n) => n.id)).toEqual([
      "input",
      "summarize",
      "output",
    ]);
    expect(result.nodes[1].position.x - result.nodes[0].position.x).toBe(330);
    expect(result.nodes[2].position.x - result.nodes[1].position.x).toBe(330);
    expect(validateGraph(result)).toEqual([]);
    expect(blank).toEqual(original);
  });
  it("preserves the selected decision route when inserting before its specialist", () => {
    const branched = structuredClone(starter);
    branched.nodes.find((n) => n.id === "writer")!.data.kind = "output";
    const result = insertStep(
      branched,
      makeNode("agent", "extra", 0, 0),
      "writer",
    ).workflow;
    expect(result.edges.find((e) => e.target === "extra")).toMatchObject({
      source: "gate",
      sourceHandle: "pass",
      label: "pass",
    });
    expect(result.edges.find((e) => e.source === "extra")).toMatchObject({
      target: "writer",
    });
    expect(
      result.edges.find((e) => e.source === "extra")?.sourceHandle,
    ).toBeUndefined();
    expect(result.nodes.find((n) => n.id === "extra")?.data.direction).toBe(
      "left",
    );
  });
  it("does not guess a route when the selected decision branches", () => {
    const result = insertStep(
      starter,
      makeNode("agent", "extra", 0, 0),
      "gate",
    );
    expect(result.workflow.edges).toEqual(starter.edges);
    expect(result.message).toContain("Connect its input");
    expect(result.workflow.nodes.at(-1)!.position.x).toBeGreaterThan(
      Math.max(...starter.nodes.map((n) => n.position.x)),
    );
  });
  it("shows dependencies before their consumers even when nodes were created later", () => {
    const workflow = insertStep(
      blank,
      makeNode("agent", "agent", 0, 0),
      null,
    ).workflow;
    workflow.nodes = [workflow.nodes[2], workflow.nodes[0], workflow.nodes[1]];
    expect(executionOrder(workflow).map((n) => n.id)).toEqual([
      "input",
      "agent",
      "output",
    ]);
    const order = executionOrder(starter).map((n) => n.id);
    for (const edge of starter.edges)
      expect(order.indexOf(edge.source)).toBeLessThan(
        order.indexOf(edge.target),
      );
  });
});
