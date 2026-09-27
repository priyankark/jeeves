import { useEffect, useState } from "react";
import { CalendarClock, Pause, Play, Trash2, Pencil } from "lucide-react";
import type { Schedule, ScheduleInput } from "../shared/automation";
import type { Workflow } from "../shared/schema";
import { api } from "./api";
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const presets = [
  ["Weekdays at 9:00", "0 9 * * 1-5"],
  ["Every day at 9:00", "0 9 * * *"],
  ["Every Monday at 9:00", "0 9 * * 1"],
  ["Every hour", "0 * * * *"],
  ["Custom cron", "custom"],
];
const localDate = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
const when = (iso: string, timezone: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(iso));
export function Schedules({
  workflow,
  mode,
  openRun,
}: {
  workflow: Workflow;
  mode: "demo" | "live";
  openRun: (id: string) => Promise<void>;
}) {
  const [items, setItems] = useState<(Schedule & { lastRunStatus?: string })[]>(
    [],
  );
  const [draft, setDraft] = useState<ScheduleInput | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [times, setTimes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [remove, setRemove] = useState<string | null>(null);
  const reload = async () => setItems(await api<Schedule[]>("/schedules"));
  useEffect(() => {
    let alive = true;
    const update = () =>
      api<Schedule[]>("/schedules")
        .then((data) => {
          if (alive) setItems(data);
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    void update();
    const timer = setInterval(update, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  const patch = (change: Partial<ScheduleInput>) => {
    setDraft((d) => d && { ...d, ...change });
    setTimes([]);
  };
  async function work(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="automation-content">
      <p className="field-note">
        Schedules run while the Jeeves engine is running and your computer is
        awake. On Mac, closing the window keeps Jeeves in the menu bar; quitting
        stops the engine. Each schedule keeps a snapshot of the workflow and
        input; canvas edits do not change it.
      </p>
      {error && (
        <p className="automation-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="automation-notice" role="status">
          {notice}
        </p>
      )}
      {draft ? (
        <form
          className="schedule-form"
          onSubmit={(e) => {
            e.preventDefault();
            void work(async () => {
              await api(editing ? `/schedules/${editing}` : "/schedules", {
                method: editing ? "PUT" : "POST",
                body: JSON.stringify(draft),
              });
              setDraft(null);
              setNotice(editing ? "Schedule updated." : "Schedule created.");
              await reload();
            });
          }}
        >
          <div className="preview-heading">
            <h3>{editing ? "Edit schedule" : "New schedule"}</h3>
            <button
              type="button"
              disabled={busy}
              onClick={() => setDraft(null)}
            >
              Cancel
            </button>
          </div>
          <label>
            Schedule name
            <input
              required
              maxLength={100}
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </label>
          <div className="schedule-snapshot">
            <strong>{draft.workflow.name}</strong>
            <span>
              {draft.workflow.nodes.length} nodes · saved workflow snapshot
            </span>
            {editing && (
              <button
                type="button"
                onClick={() =>
                  patch({
                    workflow: structuredClone(workflow),
                    input: workflow.input,
                  })
                }
              >
                Replace with current canvas
              </button>
            )}
          </div>
          <div className="form-columns">
            <label>
              Run mode
              <select
                value={draft.mode}
                onChange={(e) =>
                  patch({ mode: e.target.value as "demo" | "live" })
                }
              >
                <option value="demo">Demo · no provider calls</option>
                <option value="live">Live · uses connected providers</option>
              </select>
            </label>
            <label>
              Frequency
              <select
                value={draft.kind}
                onChange={(e) =>
                  patch({ kind: e.target.value as "cron" | "once" })
                }
              >
                <option value="cron">Recurring</option>
                <option value="once">One time</option>
              </select>
            </label>
          </div>
          {draft.kind === "cron" ? (
            <>
              <label>
                Repeat
                <select
                  value={
                    presets.some((p) => p[1] === draft.cron)
                      ? draft.cron
                      : "custom"
                  }
                  onChange={(e) =>
                    patch({
                      cron:
                        e.target.value === "custom"
                          ? "30 8 * * *"
                          : e.target.value,
                    })
                  }
                >
                  {presets.map(([name, value]) => (
                    <option value={value} key={value}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-columns">
                <label>
                  Cron expression
                  <input
                    required
                    value={draft.cron}
                    onChange={(e) => patch({ cron: e.target.value })}
                    placeholder="0 9 * * 1-5"
                  />
                </label>
                <label>
                  Time zone
                  <input
                    required
                    list="timezones"
                    value={draft.timezone}
                    onChange={(e) => patch({ timezone: e.target.value })}
                  />
                  <datalist id="timezones">
                    {[
                      zone,
                      "UTC",
                      "America/New_York",
                      "Europe/London",
                      "Asia/Kolkata",
                      "Asia/Tokyo",
                    ]
                      .filter((s, i, a) => a.indexOf(s) === i)
                      .map((z) => (
                        <option key={z} value={z} />
                      ))}
                  </datalist>
                </label>
              </div>
              <p className="field-note">
                Minute · hour · day of month · month · weekday. Times follow the
                selected zone, including daylight-saving changes.
              </p>
            </>
          ) : (
            <label>
              Run at ({zone})
              <input
                required
                type="datetime-local"
                value={draft.at ? localDate(draft.at) : ""}
                onChange={(e) =>
                  patch({
                    at: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : "",
                    timezone: zone,
                  })
                }
              />
            </label>
          )}
          <label>
            If Jeeves misses a scheduled time
            <select
              value={draft.missed}
              onChange={(e) =>
                patch({ missed: e.target.value as "skip" | "once" })
              }
            >
              <option value="skip">
                Skip occurrences more than a minute late
              </option>
              <option value="once">Run once when the engine returns</option>
            </select>
          </label>
          <p className="field-note">
            Overlapping runs of the same workflow are skipped. Missed intervals
            never produce a backlog of runs.
          </p>
          <label>
            Scheduled input JSON
            <textarea
              rows={5}
              value={draft.input}
              onChange={(e) => patch({ input: e.target.value })}
            />
          </label>
          <label className="skill-check">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => patch({ enabled: e.target.checked })}
            />
            <span>Enable schedule</span>
          </label>
          <div className="schedule-preview">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void work(async () =>
                  setTimes(
                    (
                      await api<{ times: string[] }>("/schedules/preview", {
                        method: "POST",
                        body: JSON.stringify(draft),
                      })
                    ).times,
                  ),
                )
              }
            >
              Preview upcoming runs
            </button>
            {times.length > 0 && (
              <ol>
                {times.map((t) => (
                  <li key={t}>
                    {when(t, draft.timezone)} <small>{draft.timezone}</small>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <button className="primary-button" disabled={busy} type="submit">
            {busy ? "Saving…" : editing ? "Save schedule" : "Create schedule"}
          </button>
        </form>
      ) : (
        <>
          <div className="preview-heading">
            <h3>{items.length ? "Your schedules" : "Make it a routine."}</h3>
            <button
              className="primary-button"
              onClick={() => {
                setEditing(null);
                setTimes([]);
                setDraft({
                  name: workflow.name,
                  workflow: structuredClone(workflow),
                  mode,
                  input: workflow.input,
                  kind: "cron",
                  cron: "0 9 * * 1-5",
                  timezone: zone,
                  at: new Date(Date.now() + 3600000).toISOString(),
                  enabled: true,
                  missed: "skip",
                });
              }}
            >
              New schedule
            </button>
          </div>
          {!items.length && (
            <div className="automation-empty">
              <CalendarClock size={30} />
              <h3>Your workflows, right on time.</h3>
              <p>
                Schedule a morning brief, a weekly review, or a one-time task.
              </p>
            </div>
          )}
          {items.map((s) => (
            <article className="automation-card schedule-card" key={s.id}>
              <div>
                <div className="schedule-name">
                  <strong>{s.name}</strong>
                  <span
                    className={`status-badge ${s.enabled ? "completed" : "skipped"}`}
                  >
                    {s.enabled ? "Active" : s.nextAt ? "Paused" : "Finished"}
                  </span>
                  <span className="tag">{s.mode}</span>
                </div>
                <p>
                  {s.kind === "once" ? "One time" : s.cron} · {s.timezone}
                </p>
                <p>
                  {s.enabled && s.nextAt
                    ? `Next: ${when(s.nextAt, s.timezone)}`
                    : "No upcoming run"}
                </p>
                {s.lastOutcome && (
                  <small>
                    {s.lastOutcome}
                    {s.lastRunStatus ? ` · Last run ${s.lastRunStatus}` : ""}
                  </small>
                )}
                <div className="schedule-actions">
                  <button
                    disabled={
                      busy ||
                      (!s.enabled &&
                        s.kind === "once" &&
                        Date.parse(s.at) <= Date.now())
                    }
                    onClick={() =>
                      void work(async () => {
                        await api(`/schedules/${s.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ enabled: !s.enabled }),
                        });
                        await reload();
                      })
                    }
                  >
                    {s.enabled ? <Pause size={14} /> : <Play size={14} />}
                    {s.enabled ? "Pause" : "Enable"}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setEditing(s.id);
                      setDraft(structuredClone(s));
                      setTimes([]);
                    }}
                  >
                    <Pencil size={14} />
                    Edit
                  </button>
                  {s.lastRunId && (
                    <button
                      disabled={busy}
                      onClick={() => void work(() => openRun(s.lastRunId!))}
                    >
                      View last run →
                    </button>
                  )}
                  <button
                    aria-label={`Delete ${s.name}`}
                    disabled={busy}
                    onClick={() => setRemove(s.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {remove === s.id && (
                  <div className="automation-confirm">
                    <p>
                      Delete this schedule? Existing run history will be kept.
                    </p>
                    <button onClick={() => setRemove(null)}>Keep</button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void work(async () => {
                          await api(`/schedules/${s.id}`, { method: "DELETE" });
                          setRemove(null);
                          await reload();
                        })
                      }
                    >
                      Delete schedule
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </>
      )}
    </div>
  );
}
