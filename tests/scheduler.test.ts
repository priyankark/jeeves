import { saveJson } from "../server/storage";
import { makeNode } from "../shared/schema";
import { describe, it, expect, vi } from "vitest";
import {
  Scheduler,
  nextOccurrence,
  previewOccurrences,
} from "../server/scheduler";
import { blank } from "../shared/templates";
import type { ScheduleInput } from "../shared/automation";
const base: ScheduleInput = {
  name: "Morning briefing",
  workflow: blank,
  mode: "demo",
  input: "{}",
  kind: "cron",
  cron: "0 9 * * *",
  timezone: "America/Los_Angeles",
  at: "",
  enabled: true,
  missed: "skip",
};
describe("persistent scheduling", () => {
  it("evaluates wall-clock schedules across daylight-saving changes", () => {
    expect(nextOccurrence(base, new Date("2026-03-07T18:00:00Z"))).toBe(
      "2026-03-08T16:00:00.000Z",
    );
    expect(nextOccurrence(base, new Date("2026-10-31T18:00:00Z"))).toBe(
      "2026-11-01T17:00:00.000Z",
    );
    expect(() =>
      previewOccurrences({ ...base, timezone: "invalid-zone" }),
    ).toThrow();
    expect(() => previewOccurrences({ ...base, cron: "* * * * * *" })).toThrow(
      "five cron",
    );
    expect(() => previewOccurrences({ ...base, input: "oops" })).toThrow();
  });
  it("claims a one-time occurrence once despite simultaneous ticks and restart", async () => {
    const dispatch = vi.fn(async () => {}),
      engine = new Scheduler(
        dispatch,
        () => false,
        () => true,
      );
    await engine.save(
      { ...base, kind: "once", at: "2030-01-01T10:00:00Z" },
      "once-test",
      new Date("2030-01-01T09:00:00Z"),
    );
    const due = new Date("2030-01-01T10:00:01Z");
    await Promise.all([engine.tick(due), engine.tick(due)]);
    const restarted = new Scheduler(
      dispatch,
      () => false,
      () => true,
    );
    await restarted.tick(due);
    expect(dispatch).toHaveBeenCalledTimes(1);
    const item = (await engine.list()).find((s) => s.id === "once-test")!;
    expect(item.enabled).toBe(false);
    expect(item.lastRunId).toBeTruthy();
    expect(item.lastOutcome).toBe("Started");
    await engine.remove(item.id);
  });
  it("skips downtime or catches up once without replaying a backlog", async () => {
    const dispatch = vi.fn(async () => {}),
      engine = new Scheduler(
        dispatch,
        () => false,
        () => true,
      );
    const before = new Date("2030-02-01T00:00:00Z"),
      after = new Date("2030-02-04T00:00:00Z");
    await engine.save(base, "miss-skip", before);
    await engine.save({ ...base, missed: "once" }, "miss-once", before);
    await engine.tick(after);
    expect(dispatch).toHaveBeenCalledTimes(1);
    const items = await engine.list();
    expect(items.find((s) => s.id === "miss-skip")?.lastOutcome).toContain(
      "Skipped missed",
    );
    expect(items.find((s) => s.id === "miss-once")?.nextAt).toBe(
      "2030-02-04T17:00:00.000Z",
    );
    await engine.tick(after);
    expect(dispatch).toHaveBeenCalledTimes(1);
    await engine.remove("miss-skip");
    await engine.remove("miss-once");
  });
  it("prevents overlaps, defers for capacity, and preserves paused schedules", async () => {
    let capacity = false,
      running = false;
    const dispatch = vi.fn(async () => {}),
      engine = new Scheduler(
        dispatch,
        () => running,
        () => capacity,
      );
    const before = new Date("2030-03-01T16:59:00Z"),
      due = new Date("2030-03-01T17:00:00Z");
    await engine.save(base, "capacity-test", before);
    await engine.tick(due);
    expect(dispatch).not.toHaveBeenCalled();
    expect(
      (await engine.list()).find((s) => s.id === "capacity-test")?.nextAt,
    ).toBe(due.toISOString());
    capacity = true;
    running = true;
    await engine.tick(due);
    expect(
      (await engine.list()).find((s) => s.id === "capacity-test")?.lastOutcome,
    ).toContain("already running");
    await engine.toggle("capacity-test", false);
    await engine.tick(new Date("2030-03-05T17:00:00Z"));
    expect(dispatch).not.toHaveBeenCalled();
    await engine.remove("capacity-test");
  });
  it("records dispatch failure and never retries an uncertain claim automatically", async () => {
    const dispatch = vi.fn(async () => {
      throw new Error("disk unavailable");
    });
    const engine = new Scheduler(
      dispatch,
      () => false,
      () => true,
    );
    await engine.save(
      { ...base, kind: "once", at: "2031-01-01T10:00:00Z" },
      "dispatch-failure",
      new Date("2031-01-01T09:00:00Z"),
    );
    await engine.tick(new Date("2031-01-01T10:00:00Z"));
    await engine.tick(new Date("2031-01-01T10:00:05Z"));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(
      (await engine.list()).find((s) => s.id === "dispatch-failure")
        ?.lastOutcome,
    ).toContain("disk unavailable");
    await engine.remove("dispatch-failure");
  });
  it("freezes nested workflows so later child edits do not change a schedule", async () => {
    const child = { ...blank, id: "scheduled-child", name: "Original child" };
    await saveJson("workflows", child.id, child);
    const parent = {
      ...blank,
      nodes: [
        blank.nodes[0],
        makeNode("workflow", "child", 1, 1, { workflowId: child.id }),
        blank.nodes[1],
      ],
      edges: [
        { id: "a", source: "input", target: "child" },
        { id: "b", source: "child", target: "output" },
      ],
    };
    const dispatch = vi.fn(async () => {});
    const engine = new Scheduler(
      dispatch,
      () => false,
      () => true,
    );
    const scheduled = await engine.save(
      { ...base, workflow: parent, kind: "once", at: "2035-01-01T10:00:00Z" },
      "nested-freeze",
      new Date("2035-01-01T09:00:00Z"),
    );
    await saveJson("workflows", child.id, { ...child, name: "Edited child" });
    expect(scheduled.workflowSnapshots?.[child.id].name).toBe("Original child");
    await engine.tick(new Date("2035-01-01T10:00:00Z"));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowSnapshots: expect.objectContaining({
          [child.id]: expect.objectContaining({ name: "Original child" }),
        }),
      }),
      expect.any(String),
      expect.any(String),
    );
    await engine.remove("nested-freeze");
  });
});
