import { useEffect, useMemo, useState, type ReactElement } from "react";

import type { LoopEvent, LoopRun } from "../shared/types.js";
import { needsAttention } from "../shared/types.js";
import styles from "./App.module.css";
import { durationLabel } from "./duration.js";
import { Pill, StatTile, Table, type Column } from "./kit/index.js";
import { compareRuns } from "./ordering.js";

/**
 * What the loop is doing, now.
 *
 * The ordering rule is the whole design: anything that asked for a person comes first, then
 * whatever is still running, then history. A dashboard that sorts by time alone buries the
 * one row a person has to act on under forty rows of housekeeping, so that row gets its own
 * section rather than a place near the top of one long table.
 */
export function App(): ReactElement {
  const [runs, setRuns] = useState<readonly LoopRun[]>([]);
  const [repo, setRepo] = useState("");
  const [live, setLive] = useState(false);

  useEffect(() => {
    const socket = new WebSocket(socketUrl(location));
    socket.addEventListener("open", () => setLive(true));
    socket.addEventListener("close", () => setLive(false));
    socket.addEventListener("message", (message) => {
      const event = JSON.parse(String(message.data)) as LoopEvent;
      if (event.kind === "snapshot") {
        setRuns(event.runs);
        setRepo(event.repo);
      } else {
        setRuns((current) => [event.run, ...current.filter((run) => run.id !== event.run.id)]);
      }
    });
    return () => socket.close();
  }, []);

  const ordered = useMemo(() => [...runs].sort(compareRuns), [runs]);
  const waiting = ordered.filter(needsAttention);
  const rest = ordered.filter((run) => !needsAttention(run));

  const columns: readonly Column<LoopRun>[] = [
    { key: "route", header: "Route", render: (run) => run.route },
    { key: "subject", header: "Subject", render: (run) => run.subject },
    { key: "reason", header: "Reason", render: (run) => run.reason },
    {
      key: "when",
      header: "When",
      render: (run) => <time dateTime={run.startedAt}>{new Date(run.startedAt).toLocaleString()}</time>,
    },
    { key: "took", header: "Took", render: (run) => durationLabel(run) },
  ];

  const attentionColumns: readonly Column<LoopRun>[] = [
    {
      key: "route",
      header: "Route",
      render: (run) => (
        <>
          <Pill tone="attention">{run.outcome}</Pill> {run.route}
        </>
      ),
    },
    ...columns.slice(1),
  ];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>loopscope</h1>
        <div className={styles.status}>
          {repo !== "" ? <span>{repo}</span> : null}
          <Pill tone={live ? "live" : "neutral"}>{live ? "live" : "reconnecting"}</Pill>
        </div>
      </header>

      <section className={styles.section} aria-label="waiting for a person">
        <div className={styles.attentionHead}>
          <StatTile
            label="waiting for a person"
            value={waiting.length}
            tone={waiting.length > 0 ? "attention" : "neutral"}
          />
        </div>
        {waiting.length > 0 ? (
          <Table columns={attentionColumns} rows={waiting} rowKey={(run) => run.id} rowHref={(run) => run.url} />
        ) : null}
      </section>

      <section className={styles.section} aria-label="run history">
        <h2 className={styles.sectionHeading}>Runs</h2>
        <Table
          columns={columns}
          rows={rest}
          rowKey={(run) => run.id}
          rowHref={(run) => run.url}
          emptyMessage="No runs yet."
        />
      </section>
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
