import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

import type { LoopEvent, LoopRun, Stage } from "../shared/types.js";
import { parseRepo } from "../shared/repo.js";
import { buildFlow, parsePeriod, periodWindow } from "./flow.js";
import { fetchRepoSnapshot, MetricsCache } from "./metrics.js";
import { changeFailureEntries, changeFailureRateBuckets, computeChangeFailureRate } from "./metrics/changeFailureRate.js";
import { computeDeploymentFrequency } from "./metrics/deploymentFrequency.js";
import { computeLeadTime } from "./metrics/leadTime.js";
import { timelinesOf } from "./metrics/timeline.js";
import { computeTimeToRestore, timeToRestoreBuckets } from "./metrics/timeToRestore.js";
import { forge } from "./forge.js";
import { reposOf } from "./repos.js";
import { listRuns } from "./runs.js";
import { listStages } from "./stages.js";
import { readBranchStrategy, readStageBranches, soakOf } from "./strategy.js";
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
const pollSeconds = Number(process.env["POLL_SECONDS"] ?? 300);
const metricsRefreshSeconds = Number(process.env["METRICS_REFRESH_SECONDS"] ?? 60);
const metricsCache = new MetricsCache(reposOf(), fetchRepoSnapshot);
const webRoot = process.env["WEB_ROOT"] ?? join(dirname(fileURLToPath(import.meta.url)), "..", "..", "dist");
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
// Absent where a deployment ships without .github, which is a config gap worth showing as
// "unknown" rather than a crashed server.
const classifyRoutePath = join(repoRoot, ".github", "actions", "classify-route", "classify-route.sh");
const strategy = ((): string | undefined => {
  try {
    return readBranchStrategy(classifyRoutePath);
  } catch {
    return undefined;
  }
})();
// One entry under a strategy with no chain, which promotes nothing: `listStages` is asked
// only where there is a pair of stages for a change to be frozen between.
const stageBranches = ((): string[] => {
  try {
    return readStageBranches(classifyRoutePath) ?? [];
  } catch {
    return [];
  }
})();
// Absent where the action file does not ship, or its `soak:` default does not parse: the
// pipeline graphic then shows stages with no countdown rather than a crashed endpoint.
const promoteChangeActionPath = join(repoRoot, ".github", "actions", "promote-change", "action.yml");
const soakSeconds = ((): Record<string, number> | undefined => {
  try {
    const parsed = soakOf(promoteChangeActionPath);
    if (parsed === undefined) console.warn("soak: default missing or unparsable; pipeline will show no timers");
    return parsed;
  } catch {
    console.warn("soak: action file unreadable; pipeline will show no timers");
    return undefined;
  }
})();

const repo = parseRepo(process.env["LOOP_REPO"] ?? "PersonalCorpAcc/agentic-loop-canary");

const server = createServer(async (request, response) => {
  if (request.url === "/api/repo") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(repo));
    return;
  }
  if (request.url === "/api/runs") {
    const runs = await listRuns().catch(() => [] as LoopRun[]);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(runs));
    return;
  }
  if (request.url === "/api/strategy") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ strategy: strategy ?? null }));
    return;
  }
  if (request.url === "/api/stages") {
    const stages =
      stageBranches.length < 2 ? [] : await listStages(stageBranches, soakSeconds).catch(() => [] as Stage[]);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(stages));
    return;
  }
  if (request.url?.startsWith("/api/metrics")) {
    const repo = new URL(request.url, "http://localhost").searchParams.get("repo") ?? "";
    const cached = metricsCache.get(repo);
    response.writeHead(cached === undefined ? 404 : 200, { "content-type": "application/json" });
    response.end(JSON.stringify(cached ?? { error: "not configured or not yet refreshed" }));
    return;
  }
  if (request.url?.startsWith("/api/flow")) {
    const params = new URL(request.url, "http://localhost").searchParams;
    const repo = params.get("repo") ?? "";
    const cached = metricsCache.get(repo);
    if (cached?.snapshot === undefined) {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "not configured or not yet refreshed" }));
      return;
    }
    const flow = buildFlow(cached.snapshot, parsePeriod(params.get("period")));
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(flow));
    return;
  }
  if (request.url?.startsWith("/api/lead-time")) {
    const params = new URL(request.url, "http://localhost").searchParams;
    const repo = params.get("repo") ?? "";
    const cached = metricsCache.get(repo);
    if (cached?.snapshot === undefined) {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "not configured or not yet refreshed" }));
      return;
    }
    const { from, to } = periodWindow(parsePeriod(params.get("period")), new Date());
    const leadTime = computeLeadTime(cached.snapshot.issues, cached.snapshot.issueTimelines, from, to);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(leadTime));
    return;
  }
  if (request.url?.startsWith("/api/deployment-frequency")) {
    const params = new URL(request.url, "http://localhost").searchParams;
    const repo = params.get("repo") ?? "";
    const cached = metricsCache.get(repo);
    if (cached?.snapshot === undefined) {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "not configured or not yet refreshed" }));
      return;
    }
    const { from, to } = periodWindow(parsePeriod(params.get("period")), new Date());
    const deploymentFrequency = computeDeploymentFrequency(cached.snapshot.issues, cached.snapshot.issueTimelines, from, to);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(deploymentFrequency));
    return;
  }
  if (request.url?.startsWith("/api/change-failure-rate")) {
    const params = new URL(request.url, "http://localhost").searchParams;
    const repo = params.get("repo") ?? "";
    const cached = metricsCache.get(repo);
    if (cached?.snapshot === undefined) {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "not configured or not yet refreshed" }));
      return;
    }
    const { from, to } = periodWindow(parsePeriod(params.get("period")), new Date());
    const previousFrom = new Date(from.getTime() - (to.getTime() - from.getTime()));
    const timelines = timelinesOf(cached.snapshot.issues, cached.snapshot.issueTimelines);
    const current = computeChangeFailureRate(timelines, "merged-main", from, to);
    const previous = computeChangeFailureRate(timelines, "merged-main", previousFrom, from);
    const { buckets, granularity } = changeFailureRateBuckets(timelines, "merged-main", from, to);
    const { buckets: previousBuckets } = changeFailureRateBuckets(timelines, "merged-main", previousFrom, from);
    const entries = changeFailureEntries(current.failed, cached.snapshot.issues, timelines, cached.snapshot.pullRequests);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        shipped: current.shipped,
        rate: current.rate,
        previousShipped: previous.shipped,
        previousRate: previous.rate,
        buckets,
        previousBuckets,
        granularity,
        entries,
      }),
    );
    return;
  }
  if (request.url?.startsWith("/api/time-to-restore")) {
    const params = new URL(request.url, "http://localhost").searchParams;
    const repo = params.get("repo") ?? "";
    const cached = metricsCache.get(repo);
    if (cached?.snapshot === undefined) {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "not configured or not yet refreshed" }));
      return;
    }
    const { from, to } = periodWindow(parsePeriod(params.get("period")), new Date());
    const previousFrom = new Date(from.getTime() - (to.getTime() - from.getTime()));
    const timelines = timelinesOf(cached.snapshot.issues, cached.snapshot.issueTimelines);
    const current = computeTimeToRestore(timelines, from, to);
    const previous = computeTimeToRestore(timelines, previousFrom, from);
    const { buckets, granularity } = timeToRestoreBuckets(timelines, from, to);
    const { buckets: previousBuckets } = timeToRestoreBuckets(timelines, previousFrom, from);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        averageDays: current.averageDays,
        sampleCount: current.samples.length,
        previousAverageDays: previous.averageDays,
        previousSampleCount: previous.samples.length,
        buckets,
        previousBuckets,
        granularity,
      }),
    );
    return;
  }
  if (request.url === "/api/rate-limit") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(forge.status()));
    return;
  }
  if (request.url === "/api/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
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

sockets.on("connection", (socket) => {
  // A new tab gets everything once, then only what changes. The two message kinds exist so a
  // reconnect after a laptop lid closes is a snapshot rather than a gap.
  send(socket, { kind: "snapshot", runs: [...known.values()] });
});

async function poll(): Promise<void> {
  const runs = await listRuns().catch(() => undefined);
  if (runs === undefined) return;

  const next = new Map(runs.map((run) => [run.id, run]));
  for (const run of runs) {
    const before = known.get(run.id);
    if (before === undefined || before.conclusion !== run.conclusion || before.outcome !== run.outcome) {
      for (const socket of sockets.clients) send(socket, { kind: "run", run });
    }
  }
  known = next;
}

server.listen(port, () => {
  console.log(`loopscope on http://localhost:${port}`);
  void poll();
  setInterval(() => void poll(), pollSeconds * 1000);
  void metricsCache.refresh();
  setInterval(() => void metricsCache.refresh(), metricsRefreshSeconds * 1000);
});
