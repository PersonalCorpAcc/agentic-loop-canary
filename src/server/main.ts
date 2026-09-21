import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

import type { LoopEvent, LoopRun } from "../shared/types.js";
import { HealthTracker } from "./health.js";
import { listRuns } from "./runs.js";
import { serveAsset } from "./static.js";

/**
 * The server half: it reads the loop's runs from the forge and pushes them at a browser.
 *
 * Deliberately thin. Everything it serves is something the loop already wrote -- a workflow
 * run, an outcome line, a pull request -- so this holds no database and no state beyond the
 * last snapshot. If it is switched off for a day it loses nothing.
 *
 * Polling to begin with, a webhook later: an issue tracks that, and the shape below is the
 * one a webhook drops into, because the socket already carries "here is a run" events rather
 * than "here is the whole world again".
 */

// The platform chooses the port and tells us through the environment; 8787 is only the
// local default. Binding a fixed port on a host that routes to a different one is a service
// that builds, starts, reports healthy, and answers nothing.
const port = Number(process.env["PORT"] ?? 8787);
// Unauthenticated requests are capped at 60/hour. Polling every 120s makes 30/hour: half the
// budget, comfortable room for the odd manual /api/runs hit alongside it. A token raises the
// budget to 5000/hour, at which point this default is merely unhurried.
const pollSeconds = Number(process.env["POLL_SECONDS"] ?? 120);
const webRoot = process.env["WEB_ROOT"] ?? join(dirname(fileURLToPath(import.meta.url)), "..", "..", "dist");

const health = new HealthTracker();

const server = createServer(async (request, response) => {
  if (request.url === "/api/runs") {
    const runs = await listRuns().then((result) => result.runs).catch(() => [] as LoopRun[]);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(runs));
    return;
  }
  if (request.url === "/api/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, degraded: health.degraded }));
    return;
  }
  // Everything else is the front end: a built asset, or index.html for a client route.
  serveAsset(webRoot, request.url ?? "/", response);
});

const sockets = new WebSocketServer({ server, path: "/events" });
let known = new Map<number, LoopRun>();

function send(socket: { send: (data: string) => void }, event: LoopEvent): void {
  socket.send(JSON.stringify(event));
}

function broadcast(event: LoopEvent): void {
  for (const socket of sockets.clients) send(socket, event);
}

sockets.on("connection", (socket) => {
  // A new tab gets everything once, then only what changes. The two message kinds exist so a
  // reconnect after a laptop lid closes is a snapshot rather than a gap. `degraded` rides
  // along so a tab that opens mid-outage doesn't have to wait for the next poll to find out.
  send(socket, { kind: "snapshot", runs: [...known.values()], degraded: health.degraded });
});

async function poll(): Promise<void> {
  const result = await listRuns().then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );

  const changed = result.ok ? health.recordSuccess(result.value.rateLimitRemaining) : health.recordFailure();
  if (changed) broadcast({ kind: "health", degraded: health.degraded });
  if (!result.ok) {
    console.error(`poll failed: ${result.error instanceof Error ? result.error.message : String(result.error)}`);
    return;
  }

  const { runs } = result.value;
  const next = new Map(runs.map((run) => [run.id, run]));
  for (const run of runs) {
    const before = known.get(run.id);
    if (before === undefined || before.conclusion !== run.conclusion || before.outcome !== run.outcome) {
      broadcast({ kind: "run", run });
    }
  }
  known = next;
}

server.listen(port, () => {
  console.log(`loopscope on http://localhost:${port}`);
  void poll();
  setInterval(() => void poll(), pollSeconds * 1000);
});
