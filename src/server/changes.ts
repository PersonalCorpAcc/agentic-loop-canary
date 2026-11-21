import { blockingLabelOf } from "./stages.js";
import { carriedIssuesOf } from "./runs.js";
import type { ApiIssue, ApiPullRequest, RepoSnapshot, TimelineEvent } from "./metrics.js";

/**
 * The Changes board's own state classifier (#141): every label vocabulary
 * `classify-route.sh` and `promote-change.sh` move a change through, in the
 * priority order a card is shown under -- held beats every other state, a
 * change still sitting on a chain stage beats merely being `implement`ed.
 *
 * Deliberately a different vocabulary from `flow.ts`'s `FlowStageName`: that
 * one replays the *workflow* a change moves through (backlog, building,
 * awaiting-review, ...); this one is the *board column* a change sits in
 * right now, which only ever needs the label snapshot, not a linked pull
 * request's own state.
 */

export type ChangeState =
  | { readonly kind: "held" }
  | { readonly kind: "in-review" }
  | { readonly kind: "stage"; readonly stage: string }
  | { readonly kind: "implementing" };

/**
 * Labels in, exactly one board state out, or `undefined` for a change still in triage or
 * refine -- it does not appear on the board at all. `stages` is the full configured chain
 * (`STAGE_BRANCHES`, oldest first, including the last); the last stage never gets a
 * `"stage"` match of its own because nothing promotes a change out of it.
 */
export function classifyChangeState(
  labels: readonly string[],
  stages: readonly string[],
): ChangeState | undefined {
  if (blockingLabelOf(labels) !== undefined) return { kind: "held" };
  if (labels.includes("review")) return { kind: "in-review" };

  for (let index = 0; index < stages.length - 1; index += 1) {
    const stage = stages[index]!;
    const next = stages[index + 1]!;
    if (labels.includes(`merged-${stage}`) && !labels.includes(`merged-${next}`)) {
      return { kind: "stage", stage };
    }
  }

  if (labels.includes("implement")) return { kind: "implementing" };
  return undefined;
}

/** The label whose most recent `labeled` event decides "time in state" for a classified
 *  state -- the held column reads whichever of hold/rollback/hotfix `blockingLabelOf`
 *  actually picked, not just "hold" itself. */
export function decidingLabelOf(state: ChangeState, labels: readonly string[]): string {
  switch (state.kind) {
    case "held":
      return blockingLabelOf(labels)!;
    case "in-review":
      return "review";
    case "stage":
      return `merged-${state.stage}`;
    case "implementing":
      return "implement";
  }
}

/** The most recent `labeled` event naming `label`, or `fallback` when the timeline carries
 *  none -- the issue's own `created_at`, the same fallback `replayFlowStageHistory` uses for
 *  "no relevant events". Pagination order is already oldest-first (`fetchIssueTimeline`
 *  drains every page before returning), but this sorts defensively rather than trusting it. */
export function labelEnteredAt(events: readonly TimelineEvent[], label: string, fallback: string): string {
  const matches = events
    .filter(
      (event): event is TimelineEvent & { created_at: string } =>
        event.event === "labeled" && event.label?.name === label && event.created_at !== undefined,
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  return matches[matches.length - 1]?.created_at ?? fallback;
}

/** One column's stuck threshold, in hours. A column threshold set to `0` or a value that
 *  does not parse as a positive number falls back to that column's default, rather than
 *  flagging every card in it as permanently stuck or crashing the page. */
function hoursFromEnv(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export interface ChangeThresholds {
  readonly implementing: number;
  readonly review: number;
  readonly stage: number;
  readonly held: number;
}

/** Defaults per the issue author's own answer: a stage soak is expected to take longer than
 *  active work, and a hold needs a person so it is flagged earliest of all. */
export const DEFAULT_THRESHOLDS: ChangeThresholds = {
  implementing: 24,
  review: 24,
  stage: 48,
  held: 4,
};

export function changeThresholdsOf(env: Record<string, string | undefined> = process.env): ChangeThresholds {
  return {
    implementing: hoursFromEnv(env["CHANGES_STUCK_IMPLEMENTING_HOURS"], DEFAULT_THRESHOLDS.implementing),
    review: hoursFromEnv(env["CHANGES_STUCK_REVIEW_HOURS"], DEFAULT_THRESHOLDS.review),
    stage: hoursFromEnv(env["CHANGES_STUCK_STAGE_HOURS"], DEFAULT_THRESHOLDS.stage),
    held: hoursFromEnv(env["CHANGES_STUCK_HELD_HOURS"], DEFAULT_THRESHOLDS.held),
  };
}

function thresholdHoursFor(state: ChangeState, thresholds: ChangeThresholds): number {
  switch (state.kind) {
    case "held":
      return thresholds.held;
    case "in-review":
      return thresholds.review;
    case "stage":
      return thresholds.stage;
    case "implementing":
      return thresholds.implementing;
  }
}

function labelNames(labels: readonly (string | { readonly name?: string })[]): string[] {
  return labels.map((label) => (typeof label === "string" ? label : label.name ?? ""));
}

export interface LinkedPr {
  readonly number: number;
  readonly url: string;
}

/** The open pull request linked to `issue`, read the same grammar `carriedIssuesOf` already
 *  reads a promotion body with. An issue with more than one open pull request linked to it
 *  (a reopened attempt) shows the one the forge's own linkage reports first -- the same way
 *  `issueOfCommit` in `stages.ts` picks `pulls?.[0]` -- rather than every one ever opened. */
export function linkedOpenPrOf(issue: ApiIssue, pullRequests: readonly ApiPullRequest[]): LinkedPr | undefined {
  const pr = pullRequests.find(
    (candidate) => candidate.state === "open" && carriedIssuesOf(candidate.body ?? "").includes(issue.number),
  );
  return pr === undefined ? undefined : { number: pr.number, url: pr.html_url };
}

export interface ChangeCard {
  readonly issue: number;
  readonly title: string;
  readonly url: string;
  readonly pullRequest?: LinkedPr;
  readonly enteredAt: string;
  readonly ageMs: number;
  readonly stuck: boolean;
}

export interface ChangeColumn {
  /** Stable key: "implementing", "in-review", `stage:${name}`, or "held". */
  readonly key: string;
  readonly label: string;
  readonly thresholdHours: number;
  readonly cards: readonly ChangeCard[];
}

export interface ChangesBoard {
  readonly columns: readonly ChangeColumn[];
  /** Every currently stuck card, across every column -- the "needs a person" list, oldest
   *  (longest-stuck) first. */
  readonly stuck: readonly ChangeCard[];
}

function columnKeyOf(state: ChangeState): string {
  switch (state.kind) {
    case "stage":
      return `stage:${state.stage}`;
    default:
      return state.kind;
  }
}

function columnLabelOf(state: ChangeState): string {
  switch (state.kind) {
    case "held":
      return "Held";
    case "in-review":
      return "In review";
    case "implementing":
      return "Implementing";
    case "stage":
      return state.stage.charAt(0).toUpperCase() + state.stage.slice(1);
  }
}

function buildCard(
  issue: ApiIssue,
  state: ChangeState,
  snapshot: RepoSnapshot,
  thresholds: ChangeThresholds,
  now: Date,
): ChangeCard {
  const labels = labelNames(issue.labels);
  const enteredAt = labelEnteredAt(snapshot.issueTimelines[issue.number] ?? [], decidingLabelOf(state, labels), issue.created_at);
  const ageMs = now.getTime() - new Date(enteredAt).getTime();
  const stuck = ageMs > thresholdHoursFor(state, thresholds) * 3_600_000;
  const pullRequest = linkedOpenPrOf(issue, snapshot.pullRequests);
  return {
    issue: issue.number,
    title: issue.title,
    url: issue.html_url,
    ...(pullRequest === undefined ? {} : { pullRequest }),
    enteredAt,
    ageMs,
    stuck,
  };
}

/** The board's columns in acceptance-criteria order: implementing, in review, each
 *  configured stage oldest first, held -- built off a cached snapshot and the installed
 *  chain's stage names, never a forge call of its own. Only open issues are classified: a
 *  closed one already shipped past the last stage, which has no column, or was closed some
 *  other way, and showing it would be a change no longer "in flight". */
export function buildChanges(
  snapshot: RepoSnapshot,
  stages: readonly string[],
  thresholds: ChangeThresholds,
  now: Date,
): ChangesBoard {
  const order: ChangeState[] = [
    { kind: "implementing" },
    { kind: "in-review" },
    ...stages.slice(0, -1).map((stage) => ({ kind: "stage", stage }) as const),
    { kind: "held" },
  ];

  const byKey = new Map<string, ChangeCard[]>(order.map((state) => [columnKeyOf(state), []]));

  for (const issue of snapshot.issues) {
    if (issue.state !== "open") continue;
    const state = classifyChangeState(labelNames(issue.labels), stages);
    if (state === undefined) continue;
    const key = columnKeyOf(state);
    const cards = byKey.get(key);
    // A state this issue classified as that is not one of `order`'s keys cannot happen --
    // `order` is built from the same `stages` this issue was classified against -- but the
    // map lookup is still `| undefined` to the type checker.
    if (cards === undefined) continue;
    cards.push(buildCard(issue, state, snapshot, thresholds, now));
  }

  const columns: ChangeColumn[] = order.map((state) => ({
    key: columnKeyOf(state),
    label: columnLabelOf(state),
    thresholdHours: thresholdHoursFor(state, thresholds),
    cards: (byKey.get(columnKeyOf(state)) ?? []).sort((a, b) => a.enteredAt.localeCompare(b.enteredAt)),
  }));

  const stuck = columns
    .flatMap((column) => column.cards)
    .filter((card) => card.stuck)
    .sort((a, b) => a.enteredAt.localeCompare(b.enteredAt));

  return { columns, stuck };
}
