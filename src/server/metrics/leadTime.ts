import type { TimelineEvent } from "../metrics.js";

/**
 * Lead time, defined as `implement` -> `merged-main`, computed purely off an already-fetched
 * snapshot (#144's scope decision -- this never talks to the forge itself, so it is trivially
 * unit-testable and reusable from both `/api/lead-time` and a future replay). A removed-then-
 * re-added `implement` label always uses the latest occurrence seen before `merged-main` lands,
 * not the first one ever -- see `latestImplementAt` below.
 */

export interface LeadTimeEntry {
  readonly issue: number;
  readonly title: string;
  readonly url: string;
  readonly days: number;
  readonly mergedAt: string;
}

export interface LeadTimeDailyMedian {
  readonly date: string;
  readonly medianDays: number;
}

export interface LeadTimeResult {
  readonly entries: readonly LeadTimeEntry[];
  readonly dailyMedians: readonly LeadTimeDailyMedian[];
  /** Undefined when `entries` is empty for the period -- never `0`, this codebase's "absent
   *  beats false zero" convention (e.g. `successRateOf`). */
  readonly medianDays: number | undefined;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** This issue's labelling events, oldest first. Timeline pages generally arrive in order
 *  already, but a replay must not assume that -- sorted defensively by `created_at`. */
function labeledEventsOf(events: readonly TimelineEvent[]): (TimelineEvent & { created_at: string })[] {
  return events
    .filter(
      (event): event is TimelineEvent & { created_at: string } =>
        event.event === "labeled" && event.created_at !== undefined,
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** The issue's `mergedAt` plus the `implement` lead time behind it, or `undefined` when either
 *  `merged-main` never landed, or it landed with no preceding `implement` labelling at all --
 *  both "no lead time yet" per #144's scope decision. */
function leadTimeOf(events: readonly TimelineEvent[]): { mergedAt: string; days: number } | undefined {
  let latestImplementAt: string | undefined;
  for (const event of labeledEventsOf(events)) {
    const name = event.label?.name;
    if (name === "implement") latestImplementAt = event.created_at;
    else if (name === "merged-main") {
      if (latestImplementAt === undefined) return undefined;
      const days = (new Date(event.created_at).getTime() - new Date(latestImplementAt).getTime()) / 86_400_000;
      return { mergedAt: event.created_at, days };
    }
  }
  return undefined;
}

function dailyMediansOf(entries: readonly LeadTimeEntry[]): LeadTimeDailyMedian[] {
  const byDate = new Map<string, number[]>();
  for (const entry of entries) {
    const date = new Date(entry.mergedAt).toISOString().slice(0, 10);
    const days = byDate.get(date);
    if (days === undefined) byDate.set(date, [entry.days]);
    else days.push(entry.days);
  }
  return [...byDate]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, days]) => ({ date, medianDays: median(days) }));
}

export function computeLeadTime(
  issues: readonly { number: number; title: string; html_url: string }[],
  timelines: Record<number, readonly TimelineEvent[]>,
  from: Date,
  to: Date,
): LeadTimeResult {
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const entries = issues
    .map((issue) => {
      const leadTime = leadTimeOf(timelines[issue.number] ?? []);
      if (leadTime === undefined) return undefined;
      const entry: LeadTimeEntry = {
        issue: issue.number,
        title: issue.title,
        url: issue.html_url,
        days: leadTime.days,
        mergedAt: leadTime.mergedAt,
      };
      return entry;
    })
    .filter((entry): entry is LeadTimeEntry => entry !== undefined)
    .filter((entry) => entry.mergedAt >= fromIso && entry.mergedAt <= toIso)
    .sort((a, b) => a.mergedAt.localeCompare(b.mergedAt));

  return {
    entries,
    dailyMedians: dailyMediansOf(entries),
    medianDays: entries.length === 0 ? undefined : median(entries.map((entry) => entry.days)),
  };
}
