import { snapshotWorkflowTree } from "./engine";
import { CronExpressionParser } from "cron-parser";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import {
  scheduleInput,
  type Schedule,
  type ScheduleInput,
} from "../shared/automation";
import { idSchema, validateGraph } from "../shared/schema";
import { dataDir } from "./providers";
import { listJson, saveJson, readJson } from "./storage";

export function nextOccurrence(
  config: ScheduleInput,
  after: Date,
): string | null {
  new Intl.DateTimeFormat("en", { timeZone: config.timezone }).format(after);
  if (config.kind === "once") {
    const at = Date.parse(config.at);
    if (!Number.isFinite(at)) throw new Error("Choose a valid date and time.");
    return at > after.getTime() ? new Date(at).toISOString() : null;
  }
  if (config.cron.trim().split(/\s+/).length !== 5)
    throw new Error("Use five cron fields: minute hour day month weekday.");
  return CronExpressionParser.parse(config.cron, {
    currentDate: after,
    tz: config.timezone,
  })
    .next()
    .toISOString();
}
export function previewOccurrences(raw: unknown, now = new Date()) {
  const config = scheduleInput.parse(raw);
  const times: string[] = [];
  let cursor = now;
  for (let i = 0; i < 5; i++) {
    const next = nextOccurrence(config, cursor);
    if (!next) break;
    times.push(next);
    cursor = new Date(next);
  }
  if (!times.length) throw new Error("Choose a future date and time.");
  return times;
}
type Dispatch = (
  schedule: Schedule,
  runId: string,
  scheduledAt: string,
) => Promise<void>;
export class Scheduler {
  private queue: Promise<unknown> = Promise.resolve();
  private timer?: ReturnType<typeof setInterval>;
  private ticking = false;
  constructor(
    private dispatch: Dispatch,
    private running: (workflowId: string) => boolean,
    private capacity: () => boolean,
  ) {}
  private locked<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.catch(() => {}).then(work);
    this.queue = next;
    return next;
  }
  list() {
    return this.locked(() => listJson<Schedule>("schedules"));
  }
  save(raw: unknown, id: string = randomUUID(), now = new Date()) {
    return this.locked(async () => {
      idSchema.parse(id);
      const config = scheduleInput.parse(raw);
      const errors = validateGraph(config.workflow);
      if (errors.length) throw new Error(errors.join(" "));
      const nextAt = previewOccurrences(config, now)[0];
      const workflowSnapshots = await snapshotWorkflowTree(config.workflow);
      let previous: Schedule | undefined;
      try {
        previous = await readJson<Schedule>("schedules", id);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
      const schedule: Schedule = {
        ...previous,
        ...config,
        workflowSnapshots,
        id,
        createdAt: previous?.createdAt || now.toISOString(),
        nextAt,
      };
      await saveJson("schedules", id, schedule);
      return schedule;
    });
  }
  toggle(id: string, enabled: boolean, now = new Date()) {
    return this.locked(async () => {
      const schedule = await readJson<Schedule>("schedules", id);
      schedule.enabled = enabled;
      if (enabled) schedule.nextAt = previewOccurrences(schedule, now)[0];
      await saveJson("schedules", id, schedule);
      return schedule;
    });
  }
  remove(id: string) {
    return this.locked(async () => {
      idSchema.parse(id);
      await unlink(path.join(dataDir, "schedules", `${id}.json`));
    });
  }
  tick(now = new Date()) {
    return this.locked(async () => {
      const schedules = (await listJson<Schedule>("schedules")).sort((a, b) =>
        (a.nextAt || "").localeCompare(b.nextAt || ""),
      );
      for (const s of schedules) {
        if (!s.enabled || !s.nextAt || Date.parse(s.nextAt) > now.getTime())
          continue;
        const due = s.nextAt;
        const late = now.getTime() - Date.parse(due) > 60_000;
        let skip =
          late && s.missed === "skip"
            ? "Skipped missed occurrence"
            : this.running(s.workflow.id)
              ? "Skipped: workflow already running"
              : "";
        if (!skip && !this.capacity()) continue; // Leave pending until capacity or missed-run policy applies.
        const runId = randomUUID();
        s.nextAt = nextOccurrence(s, now);
        s.enabled = !!s.nextAt;
        s.lastAt = due;
        s.lastOutcome = skip || "Dispatch claimed";
        if (!skip) s.lastRunId = runId;
        // Persist the claim BEFORE dispatch. A crash never automatically replays side effects.
        await saveJson("schedules", s.id, s);
        if (!skip) {
          try {
            await this.dispatch(s, runId, due);
            s.lastOutcome = "Started";
          } catch (error) {
            s.lastOutcome = `Could not start: ${(error as Error).message}`;
          }
          await saveJson("schedules", s.id, s);
        }
      }
    });
  }
  start() {
    const step = async () => {
      if (this.ticking) return;
      this.ticking = true;
      try {
        await this.tick();
      } catch (e) {
        console.error("Scheduler:", e);
      } finally {
        this.ticking = false;
      }
    };
    this.timer = setInterval(() => void step(), 1000);
    this.timer.unref();
    void step();
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
  }
}
