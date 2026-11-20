import type { ApiIssue, ApiPullRequest, ApiTimelineEvent, RepoSnapshot } from "./metrics.js";
import type { Period } from "../shared/period.js";
import { blockingLabelOf } from "./stages.js";
import { carriedIssuesOf } from "./runs.js";

/**
 * One deterministic classifier, reused for "where is this issue right now" and for "where has
 * it been": both read the same labels through {@link classifyFlowStage}, the first with an
 * issue's current labels, the second by replaying its timeline (see {@link replayHistory}).
 *
 * Deliberately not `Stage`/`StageBlock` from `../shared/types.ts`: those name a branch in the
 * promotion chain (frozen, blockedBy), a different concept from a workflow stage. `FlowStageName`
 * and `FlowItem` are this story's own vocabulary.
 *
 * Known limitations, left as such rather than guessed around:
 * - An issue closed without ever reaching `merged-main` (closed as a duplicate or won't-fix)
 *   classifies `shipped`: the forge gives no reliable "closed as done" vs "closed as abandoned"
 *   signal without an undocumented label, so this version treats every closed issue as shipped.
 *   This override is applied by {@link flowFor}, not inside {@link classifyFlowStage} itself,
 *   because the classifier's signature is labels-only and has no notion of issue state.
 * - {@link replayHistory} reuses the *current* linked pull request's labels and state at every
 *   point in an issue's history, because the timeline API reports what changed on the issue,
 *   not a snapshot of the linked PR's own labels at each past moment. A PR's labels seen in
 *   history are therefore only ever as fresh as its labels right now.
 */

export const FLOW_STAGE_NAMES = [
  "backlog",
  "specifying",
  "needs-answers",
  "ready",
  "building",
  "validating",
  "awaiting-review",
  "deploying",
  "shipped",
] as const;

export type FlowStageName = (typeof FLOW_STAGE_NAMES)[number];

/** The two `blockingLabelOf` labels #159 calls an overlay rather than a stage: `hotfix` stops
 *  a promotion too, but is not one of these two, so it does not set `held`. */
const HELD_LABELS = new Set(["hold", "rollback"]);

export interface FlowLinkedPullRequest {
  readonly labels: readonly string[];
  readonly state: string;
}

export interface FlowClassification {
  readonly stage: FlowStageName;
  readonly held: boolean;
}

export interface FlowStageEntry {
  readonly stage: FlowStageName;
  readonly enteredAt: string;
}

export interface FlowItem {
  readonly issue: number;
  readonly title: string;
  readonly url: string;
  readonly stage: FlowStageName;
  readonly held: boolean;
  readonly history: readonly FlowStageEntry[];
}

export interface FlowCfdEntry {
  readonly date: string;
  readonly counts: Record<FlowStageName, number>;
}

export interface FlowResult {
  readonly items: readonly FlowItem[];
  readonly cfd: readonly FlowCfdEntry[];
}

function isHeld(labels: readonly string[]): boolean {
  const blocking = blockingLabelOf(labels);
  return blocking !== undefined && HELD_LABELS.has(blocking);
}

/** Label objects or plain names, the same two shapes the forge's own `labels` field can take
 *  (see `stages.ts`'s `labelsOf`). */
function namesOf(labels: readonly (string | { readonly name?: string })[]): string[] {
  return labels.map((label) => (typeof label === "string" ? label : label.name ?? ""));
}

/**
 * One pure function, reused for "now" and for every point replayed out of history.
 *
 * `requiredApprovalMissing` is a placeholder for a PR's `review_decision`, not yet part of
 * #154's cached pull request shape: a later story can supply it without rewriting this
 * function. Until then, `awaiting-review` falls back to the `review` label alone.
 */
export function classifyFlowStage(
  labels: readonly string[],
  linkedPr?: FlowLinkedPullRequest,
  requiredApprovalMissing = false,
): FlowClassification {
  const held = isHeld(labels);
  const prOpen = linkedPr?.state === "open";
  const prCarries = (label: string): boolean => prOpen === true && (linkedPr?.labels.includes(label) ?? false);

  if (labels.includes("merged-main")) return { stage: "shipped", held };
  if (labels.includes("merged-dev") || labels.includes("merged-test")) return { stage: "deploying", held };
  if ((labels.includes("pr-pending") && labels.includes("review")) || requiredApprovalMissing || prCarries("review")) {
    return { stage: "awaiting-review", held };
  }
  if (labels.includes("pr-pending") || prCarries("merge-gate")) return { stage: "validating", held };
  if (labels.includes("implement") && labels.includes("bot-working")) return { stage: "building", held };
  if (labels.includes("refined") && labels.includes("implement")) return { stage: "ready", held };
  if (labels.includes("review")) return { stage: "needs-answers", held };
  if (labels.includes("refine") || (labels.includes("bot-working") && !labels.includes("implement"))) {
    return { stage: "specifying", held };
  }
  return { stage: "backlog", held };
}

/** The bot pull request carrying `issue` -- an ordinary implement PR (`link-pr-to-issue` stamps
 *  exactly one `implement-issue` marker) or a multi-issue promotion snapshot that carries it
 *  among others -- preferring one still open over one already closed, same marker grammar as
 *  `runs.ts`'s `carriedIssuesOf`. */
export function linkedPullRequestFor(
  issueNumber: number,
  pullRequests: readonly ApiPullRequest[],
): FlowLinkedPullRequest | undefined {
  const matches = pullRequests.filter((pr) => carriedIssuesOf(pr.body ?? "").includes(issueNumber));
  if (matches.length === 0) return undefined;
  const chosen = matches.find((pr) => pr.state === "open") ?? matches[matches.length - 1]!;
  return { labels: namesOf(chosen.labels), state: chosen.state };
}

/** Replays an issue's timeline through {@link classifyFlowStage}, one entry per `labeled` /
 *  `unlabeled` event that actually changes the classified stage. The timeline reports what
 *  changed, not a label snapshot at each point, so the label set right after each event is
 *  reconstructed backward from the issue's current labels -- undoing each later event in turn --
 *  rather than forward from an unknown starting set. */
export function replayHistory(
  createdAt: string,
  currentLabels: readonly string[],
  events: readonly ApiTimelineEvent[],
  linkedPr?: FlowLinkedPullRequest,
  requiredApprovalMissing = false,
): FlowStageEntry[] {
  const labelEvents = events
    .filter((event) => event.event === "labeled" || event.event === "unlabeled")
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  if (labelEvents.length === 0) {
    const { stage } = classifyFlowStage(currentLabels, linkedPr, requiredApprovalMissing);
    return [{ stage, enteredAt: createdAt }];
  }

  const labelsAfter: string[][] = new Array(labelEvents.length);
  labelsAfter[labelEvents.length - 1] = [...currentLabels];
  for (let i = labelEvents.length - 2; i >= 0; i -= 1) {
    const undone = new Set(labelsAfter[i + 1]!);
    const next = labelEvents[i + 1]!;
    const name = next.label?.name;
    if (name !== undefined) {
      if (next.event === "labeled") undone.delete(name);
      else undone.add(name);
    }
    labelsAfter[i] = [...undone];
  }

  const entries: FlowStageEntry[] = [];
  for (let i = 0; i < labelEvents.length; i += 1) {
    const { stage } = classifyFlowStage(labelsAfter[i]!, linkedPr, requiredApprovalMissing);
    const last = entries[entries.length - 1];
    if (last === undefined || last.stage !== stage) {
      entries.push({ stage, enteredAt: labelEvents[i]!.created_at });
    }
  }
  return entries;
}

/** A closed issue overrides to `shipped` at its close time -- see the module comment's first
 *  known limitation -- unless its history already ends there (a `merged-main` label landed
 *  before the close, which `stage-merge` usually applies first). */
function withClosedOverride(history: readonly FlowStageEntry[], closedAt: string): readonly FlowStageEntry[] {
  const last = history[history.length - 1];
  if (last !== undefined && last.stage === "shipped") return history;
  return [...history, { stage: "shipped", enteredAt: closedAt }];
}

function emptyCounts(): Record<FlowStageName, number> {
  const counts = {} as Record<FlowStageName, number>;
  for (const stage of FLOW_STAGE_NAMES) counts[stage] = 0;
  return counts;
}

/** The stage an item's history says it was in as of `atIso`, or `undefined` for a moment
 *  before its first history entry. */
function stageAt(history: readonly FlowStageEntry[], atIso: string): FlowStageName | undefined {
  let current: FlowStageName | undefined;
  for (const entry of history) {
    if (entry.enteredAt > atIso) break;
    current = entry.stage;
  }
  return current;
}

/** One CFD entry per day across `days` days ending today (inclusive), each stage present with
 *  an explicit `0` rather than an absent key. */
export function cfdBucketsOf(
  items: readonly { readonly history: readonly FlowStageEntry[] }[],
  days: number,
  nowIso: string,
): FlowCfdEntry[] {
  const end = new Date(nowIso);
  const buckets: FlowCfdEntry[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(end);
    day.setUTCDate(day.getUTCDate() - offset);
    const date = day.toISOString().slice(0, 10);
    const atIso = `${date}T23:59:59.999Z`;
    const counts = emptyCounts();
    for (const item of items) {
      const stage = stageAt(item.history, atIso);
      if (stage !== undefined) counts[stage] += 1;
    }
    buckets.push({ date, counts });
  }
  return buckets;
}

function daysOf(period: Period): number {
  return Number(period.replace("d", ""));
}

/** Everything `/api/flow` serves, built only from a cached {@link RepoSnapshot} -- no call
 *  here ever reaches the forge, the same contract #154 established for `/api/metrics`. */
export function flowFor(snapshot: RepoSnapshot, period: Period, now: () => string = () => new Date().toISOString()): FlowResult {
  const nowIso = now();
  const timelines = snapshot.issueTimelines ?? {};

  const items: FlowItem[] = snapshot.issues.map((issue: ApiIssue) => {
    const labels = namesOf(issue.labels);
    const linkedPr = linkedPullRequestFor(issue.number, snapshot.pullRequests);
    const events = timelines[issue.number] ?? [];
    const replayed = replayHistory(issue.created_at, labels, events, linkedPr);
    const closed = issue.state === "closed";
    const history = closed ? withClosedOverride(replayed, issue.closed_at ?? nowIso) : replayed;
    const classification = closed
      ? { stage: "shipped" as FlowStageName, held: isHeld(labels) }
      : classifyFlowStage(labels, linkedPr);

    return {
      issue: issue.number,
      title: issue.title,
      url: issue.html_url,
      stage: classification.stage,
      held: classification.held,
      history,
    };
  });

  const cfd = cfdBucketsOf(items, daysOf(period), nowIso);
  return { items, cfd };
}
