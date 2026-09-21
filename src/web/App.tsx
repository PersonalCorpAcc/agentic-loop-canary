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
    const socket = new WebSocket(socketUrl(location));
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
            {run.carriedIssues === undefined ? (
              <span>{run.subject}</span>
            ) : (
              <span>
                {run.carriedIssues.map((issue, index) => (
                  <span key={issue}>
                    {index > 0 ? ", " : ""}
                    <a href={issueUrl(run.url, issue)}>#{issue}</a>
                  </span>
                ))}
              </span>
            )}
            <span>{run.reason}</span>
            <time dateTime={run.startedAt}>{new Date(run.startedAt).toLocaleTimeString()}</time>
          </li>
        ))}
      </ol>
    </main>
  );
}

/**
 * The socket's address, from the page's own.
 *
 * `wss:` when the page is https, or the browser refuses it as mixed content -- which is every
 * deployment behind TLS, and none of local development, so it is exactly the kind of thing
 * that works everywhere it is tested and fails where it is used.
 */
export function socketUrl(from: Pick<Location, "protocol" | "host" | "hostname">): string {
  const scheme = from.protocol === "https:" ? "wss:" : "ws:";
  // Locally the API runs on its own port beside Vite; in a deployment one process serves
  // both, so the page's host is the right answer.
  const host = from.host.includes(":5173") ? `${from.hostname}:8787` : from.host;
  return `${scheme}//${host}/events`;
}

/** An issue's page on the same repository a run's own `html_url` names, since the server
 *  never tells the page which repository it is watching. */
export function issueUrl(runUrl: string, issue: number): string {
  const match = /^(https:\/\/github\.com\/[^/]+\/[^/]+)\//.exec(runUrl);
  return match === null ? `#${issue}` : `${match[1]}/issues/${issue}`;
}

/** Attention first, then unfinished, then newest. */
export function compareRuns(a: LoopRun, b: LoopRun): number {
  if (needsAttention(a) !== needsAttention(b)) return needsAttention(a) ? -1 : 1;
  const running = (run: LoopRun): boolean => run.finishedAt === undefined;
  if (running(a) !== running(b)) return running(a) ? -1 : 1;
  return b.startedAt.localeCompare(a.startedAt);
}
