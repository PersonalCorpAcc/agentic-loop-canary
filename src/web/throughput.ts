import type { FlowItem } from "../server/flow.js";
import { shippedInPeriod } from "./timeInStageBar.js";

/** One day's shipped-item count, #164's throughput bar chart data. */
export interface ThroughputDay {
  readonly date: string;
  readonly count: number;
}

function lastEnteredAt(item: FlowItem): string | undefined {
  return item.history[item.history.length - 1]?.enteredAt;
}

function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** One entry per UTC day in `[from, to]`, the count of items whose `shipped` entry falls that
 *  day. A day with no ships is an explicit `0`, never an absent key, so a bar chart can index
 *  every day in the period without a caller filling gaps. */
export function throughputByDay(items: readonly FlowItem[], from: Date, to: Date): ThroughputDay[] {
  const shipped = shippedInPeriod(items, from.toISOString(), to.toISOString());
  const byDate = new Map<string, number>();
  for (const item of shipped) {
    const enteredAt = lastEnteredAt(item);
    if (enteredAt === undefined) continue;
    const date = utcDay(new Date(enteredAt)).toISOString().slice(0, 10);
    byDate.set(date, (byDate.get(date) ?? 0) + 1);
  }

  const days: ThroughputDay[] = [];
  const cursor = utcDay(from);
  const end = utcDay(to);
  while (cursor.getTime() <= end.getTime()) {
    const date = cursor.toISOString().slice(0, 10);
    days.push({ date, count: byDate.get(date) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}
