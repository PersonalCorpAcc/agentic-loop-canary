import { useEffect, useMemo, useState, type ReactElement } from "react";

import type { LoopEvent, LoopRun } from "../shared/types.js";
import { needsAttention } from "../shared/types.js";

/**
 * What the loop is doing, now.
 *
 * The ordering rule is the whole design: anything that asked for a person comes first, then
 * whatever is still running, then history. A dashboard that sorts by time alone buries the
 * one row a person has to act on under forty rows of housekeeping.
 */
export function App(): ReactElement {
  const [runs, setRuns] = useState<readonly LoopRun[]>([]);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const socket = new WebSocket(`ws://${location.hostname}:8787/events`);
    socket.addEventListener("open", () => setLive(true));
    socket.addEventListener("close", () => setLive(false));
    socket.addEventListener("message", (message) => {
      const event = JSON.parse(String(message.data)) as LoopEvent;
      setRuns((current) => event.kind === "snapshot"
        ? event.runs
        : [event.run, ...current.filter((run) => run.id !== event.run.id)]);
    });
    return () => socket.close();
  }, []);

  const ordered = useMemo(() => [...runs].sort(compareRuns), [runs]);
  const waiting = ordered.filter(needsAttention).length;

  return (
    <main>
      <header>
        <h1>loopscope</h1>
        <p>
          {live ? "live" : "reconnecting"} · {runs.length} run(s)
          {waiting > 0 ? ` · ${waiting} waiting for a person` : ""}
        </p>
      </header>
      <ol>
        {ordered.map((run) => (
          <li key={run.id} data-attention={needsAttention(run)}>
            <a href={run.url}>{run.route}</a>
            <span>{run.subject}</span>
            <span>{run.reason}</span>
            <time dateTime={run.startedAt}>{new Date(run.startedAt).toLocaleTimeString()}</time>
          </li>
        ))}
      </ol>
    </main>
  );
}

/** Attention first, then unfinished, then newest. */
export function compareRuns(a: LoopRun, b: LoopRun): number {
  if (needsAttention(a) !== needsAttention(b)) return needsAttention(a) ? -1 : 1;
  const running = (run: LoopRun): boolean => run.finishedAt === undefined;
  if (running(a) !== running(b)) return running(a) ? -1 : 1;
  return b.startedAt.localeCompare(a.startedAt);
}
