import { blockingLabelOf } from "./stages.js";
import type { RepoSnapshot, ApiIssue, ApiPullRequest, TimelineEvent } from "./metrics.js";
import { carriedIssuesOf } from "./runs.js";

/**
 * The Flow page's one deterministic classifier: labels in, exactly one factory stage out --
 * the same arithmetic for "where is this right now" and "where has it been over time"
 * (#161, the contract #159 wrote). Deliberately a different vocabulary from `stages.ts`'s
 * `Stage` / `StageBlock`: those name a branch in the promotion chain, these name a workflow
 * stage, and the two must never collide.
 */

export type FlowStageName =
  | "backlog"
  | "specifying"
  | "needs-answers"
  | "ready"
  | "building"
  | "validating"
  | "awaiting-review"
  | "deploying"
  | "shipped";

/** In table order, the order the CFD stacks its areas. */
export const FLOW_STAGES: readonly FlowStageName[] = [
  "backlog",
  "specifying",
  "needs-answers",
  "ready",
  "building",
  "validating",
  "awaiting-review",
  "deploying",
  "shipped",
];

/** What `classifyFlowStage` needs of a linked pull request. `reviewDecision` is optional
 *  because #154's cached pull request shape does not carry `review_decision` yet -- a later
 *  story can supply it here without a second rewrite of this function. */
export interface LinkedPr {
  readonly labels: readonly string[];
  readonly state: "open" | "closed";
  readonly reviewDecision?: string | null;
}

export interface FlowClassification {
  readonly stage: FlowStageName;
  readonly held: boolean;
}

/** True once a required approval is known to be missing. Only `REVIEW_REQUIRED` means
 *  that: `null` can mean "no review required at all", and `APPROVED` / `CHANGES_REQUESTED`
 *  are not what this edge case describes. */
function approvalMissing(reviewDecision: string | null | undefined): boolean {
  return reviewDecision === "REVIEW_REQUIRED";
}

/**
 * One issue's labels (plus its linked pull request, when it has one) in, exactly one
 * {@link FlowStageName} out, per the table #159 wrote.
 *
 * Known limitation: an issue closed without ever reaching `merged-main` -- closed as a
 * duplicate or won't-fix, say -- classifies as `shipped` here, the same as one that shipped
 * cleanly. The forge gives no reliable "closed as done" vs. "closed as abandoned" signal
 * without inventing a label nobody writes, so this guesses the common case rather than the
 * rare one.
 */
export function classifyFlowStage(
  labels: readonly string[],
  linkedPr?: LinkedPr,
  issueState: "open" | "closed" = "open",
): FlowClassification {
  const held = ((): boolean => {
    const label = blockingLabelOf(labels);
    return label === "hold" || label === "rollback";
  })();

  const has = (label: string): boolean => labels.includes(label);

  const stage = ((): FlowStageName => {
    if (issueState === "closed" || has("merged-main")) return "shipped";
    if (has("merged-dev") || has("merged-test")) return "deploying";
    if (
      linkedPr !== undefined &&
      linkedPr.state === "open" &&
      (linkedPr.labels.includes("review") || approvalMissing(linkedPr.reviewDecision))
    ) {
      return "awaiting-review";
    }
    if (
      linkedPr !== undefined &&
      linkedPr.state === "open" &&
      (linkedPr.labels.includes("pr-pending") || linkedPr.labels.includes("merge-gate"))
    ) {
      return "validating";
    }
    if (has("review")) return "needs-answers";
    if (has("implement") && has("bot-working")) return "building";
    if (has("refined") && has("implement") && !has("bot-working")) return "ready";
    if (has("refine") || (has("bot-working") && !has("implement"))) return "specifying";
    return "backlog";
  })();

  return { stage, held };
}

/** One point the replayed history entered a stage. */
export interface FlowStageEntry {
  readonly stage: FlowStageName;
  readonly enteredAt: string;
}

/** The label/open-closed events a replay cares about, each carrying its own timestamp. */
function relevantEvents(
  events: readonly TimelineEvent[],
): (TimelineEvent & { readonly created_at: string })[] {
  return events
    .filter(
      (event): event is TimelineEvent & { created_at: string } =>
        event.created_at !== undefined &&
        (event.event === "labeled" ||
          event.event === "unlabeled" ||
          event.event === "closed" ||
          event.event === "reopened"),
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/**
 * The same classifier, replayed over an issue's own label timeline: one ordered
 * `{stage, enteredAt}` list, deduplicated so two events that do not change the classified
 * stage do not produce two entries.
 *
 * Known limitation: this replays only the issue's own `labeled` / `unlabeled` (and
 * `closed` / `reopened`) events -- it does not track a linked pull request's label history
 * over time, because the timeline this is built from carries none of that. `validating` and
 * `awaiting-review`, which need a linked pull request's own state, never appear in history
 * because of this; they are accurate only in the "current" classification `buildFlow` also
 * produces. A later story can thread per-point pull request state through this same shape
 * once the cache carries pull request timelines too.
 */
export function replayFlowStageHistory(
  events: readonly TimelineEvent[],
  current: { readonly labels: readonly string[]; readonly createdAt: string },
): FlowStageEntry[] {
  const relevant = relevantEvents(events);

  if (relevant.length === 0) {
    const { stage } = classifyFlowStage(current.labels, undefined, "open");
    return [{ stage, enteredAt: current.createdAt }];
  }

  const labels = new Set<string>();
  let issueState: "open" | "closed" = "open";
  const entries: FlowStageEntry[] = [];

  const record = (at: string): void => {
    const { stage } = classifyFlowStage([...labels], undefined, issueState);
    const last = entries[entries.length - 1];
    if (last === undefined || last.stage !== stage) entries.push({ stage, enteredAt: at });
  };

  record(current.createdAt);
  for (const event of relevant) {
    if (event.event === "labeled" && event.label?.name !== undefined) labels.add(event.label.name);
    else if (event.event === "unlabeled" && event.label?.name !== undefined) labels.delete(event.label.name);
    else if (event.event === "closed") issueState = "closed";
    else if (event.event === "reopened") issueState = "open";
    record(event.created_at);
  }

  return entries;
}

/** The stage a replayed history says an item was in at `at`, or `undefined` before the
 *  item's first entry -- it did not exist yet. */
export function stageAt(history: readonly FlowStageEntry[], at: string): FlowStageName | undefined {
  let result: FlowStageName | undefined;
  for (const entry of history) {
    if (entry.enteredAt > at) break;
    result = entry.stage;
  }
  return result;
}

/** One classified item: an issue's current stage plus its replayed history. */
export interface FlowItem {
  readonly issue: number;
  readonly title: string;
  readonly url: string;
  readonly stage: FlowStageName;
  readonly held: boolean;
  readonly history: readonly FlowStageEntry[];
  readonly durationsMs: Record<FlowStageName, number>;
  /** The issue's own `created_at` (#154's cache), carried through so a lead-time computation
   *  (#164) can pair it with the item's `shipped` history entry without a second API shape. */
  readonly createdAt: string;
}

export interface CfdBucket {
  readonly date: string;
  readonly counts: Record<FlowStageName, number>;
}

export interface FlowResult {
  readonly items: readonly FlowItem[];
  readonly cfd: readonly CfdBucket[];
  /** The resolved period window (#165), so a caller can filter "items in the period" (e.g.
   *  shipped items for the time-in-stage bar) without re-deriving period math of its own. */
  readonly from: string;
  readonly to: string;
}

/** Milliseconds spent in each stage a replayed `history` actually passed through: the gap to
 *  the next entry, or to `now` for the last one (#165). A stage `history` never entered (for
 *  example `validating` / `awaiting-review`, which #161's replay cannot represent -- see
 *  `replayFlowStageHistory`'s doc comment) gets an explicit `0` rather than being absent, so a
 *  caller can always index the full `FlowStageName` set. A zero-length gap between two entries
 *  (entered and left within the same poll) is likewise an explicit `0`, never dropped -- the
 *  full record always sums to `now - history[0].enteredAt`. */
export function stageDurations(history: readonly FlowStageEntry[], now: string): Record<FlowStageName, number> {
  const durations = zeroCounts();
  for (let i = 0; i < history.length; i += 1) {
    const entry = history[i];
    if (entry === undefined) continue;
    const nextAt = history[i + 1]?.enteredAt ?? now;
    durations[entry.stage] += new Date(nextAt).getTime() - new Date(entry.enteredAt).getTime();
  }
  return durations;
}

/** The `period` query string's shape, parsed locally until `src/shared/period.ts` lands in
 *  #158 -- once it does, this should be reconciled with that shared module rather than kept
 *  as a second parser. */
export type Period = { readonly days: number } | { readonly all: true };

export function parsePeriod(raw: string | null | undefined): Period {
  if (raw === "all") return { all: true };
  const match = raw === null || raw === undefined ? null : /^(\d+)d$/.exec(raw);
  return { days: match === null ? 30 : Number(match[1]) };
}

function labelNames(labels: readonly (string | { readonly name?: string })[]): string[] {
  return labels.map((label) => (typeof label === "string" ? label : label.name ?? ""));
}

/** The pull request linked to `issue`, read the same way `carriedIssuesOf` already reads a
 *  promotion's body: an ordinary implement pull request carries exactly one
 *  `implement-issue` marker of its own, which is the same grammar. Prefers an open one; a
 *  closed one is kept only so a shipped item still has something to show, and never
 *  satisfies an "open" check either way. */
function linkedPrOf(issue: ApiIssue, pullRequests: readonly ApiPullRequest[]): LinkedPr | undefined {
  const candidates = pullRequests.filter((pr) => carriedIssuesOf(pr.body ?? "").includes(issue.number));
  const pr = candidates.find((candidate) => candidate.state === "open") ?? candidates[0];
  if (pr === undefined) return undefined;
  return { labels: labelNames(pr.labels), state: pr.state === "open" ? "open" : "closed" };
}

function buildFlowItem(issue: ApiIssue, snapshot: RepoSnapshot, now: Date): FlowItem {
  const labels = labelNames(issue.labels);
  const issueState = issue.state === "closed" ? "closed" : "open";
  const linkedPr = linkedPrOf(issue, snapshot.pullRequests);
  const { stage, held } = classifyFlowStage(labels, linkedPr, issueState);
  const history = replayFlowStageHistory(snapshot.issueTimelines[issue.number] ?? [], {
    labels,
    createdAt: issue.created_at,
  });
  const durationsMs = stageDurations(history, now.toISOString());
  return {
    issue: issue.number,
    title: issue.title,
    url: issue.html_url,
    stage,
    held,
    history,
    durationsMs,
    createdAt: issue.created_at,
  };
}

function zeroCounts(): Record<FlowStageName, number> {
  const counts = {} as Record<FlowStageName, number>;
  for (const stage of FLOW_STAGES) counts[stage] = 0;
  return counts;
}

function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** One CFD entry per day in `[from, to]`, each item's stage looked up from its replayed
 *  history at the end of that day. A stage with no items on a day is an explicit `0`, never
 *  an absent key. */
export function cfdBuckets(
  items: readonly Pick<FlowItem, "history">[],
  from: Date,
  to: Date,
): CfdBucket[] {
  const buckets: CfdBucket[] = [];
  const cursor = utcDay(from);
  const end = utcDay(to);
  while (cursor.getTime() <= end.getTime()) {
    const date = cursor.toISOString().slice(0, 10);
    const endOfDay = `${date}T23:59:59.999Z`;
    const counts = zeroCounts();
    for (const item of items) {
      const stage = stageAt(item.history, endOfDay);
      if (stage !== undefined) counts[stage] += 1;
    }
    buckets.push({ date, counts });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return buckets;
}

function earliestCreatedAt(issues: readonly ApiIssue[]): Date | undefined {
  return issues
    .map((issue) => new Date(issue.created_at))
    .sort((a, b) => a.getTime() - b.getTime())[0];
}

/** A `Period` resolved against `now` into concrete `from`/`to` instants -- the one piece of
 *  date math `buildFlow` needs, factored out so `/api/lead-time` (#144) can reuse the same
 *  "all" vs. "days" branch rather than duplicating it a second time in `main.ts`. `allFrom` is
 *  an optional fallback for the "all" branch's `from` (defaulting to `now`, an empty window)
 *  -- `buildFlow` passes its snapshot's earliest issue `created_at` here so this stays the
 *  single place the "all" vs. "days" branch is written, rather than re-checking `period` a
 *  second time in `buildFlow` just to override `from` afterwards. */
export function periodWindow(period: Period, now: Date, allFrom?: Date): { from: Date; to: Date } {
  const to = now;
  const from = "all" in period ? allFrom ?? to : new Date(to.getTime() - period.days * 86_400_000);
  return { from, to };
}

/** Classified items and day-bucketed CFD counts, built entirely from a cached snapshot --
 *  never a live forge read (#154's contract, which `/api/flow` keeps). */
export function buildFlow(snapshot: RepoSnapshot, period: Period, now: Date = new Date()): FlowResult {
  const items = snapshot.issues.map((issue) => buildFlowItem(issue, snapshot, now));
  const { from, to } = periodWindow(period, now, earliestCreatedAt(snapshot.issues));
  return { items, cfd: cfdBuckets(items, from, to), from: from.toISOString(), to: to.toISOString() };
}
