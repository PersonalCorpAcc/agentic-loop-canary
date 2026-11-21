/** Top-bar period selector values, carried in the `?period=` query param. */
export const PERIODS = ["7d", "30d", "90d"] as const;
export type Period = (typeof PERIODS)[number];

export const DEFAULT_PERIOD: Period = "30d";

export const PERIOD_LABELS: Record<Period, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
};

/** Validates a raw `?period=` value, falling back to {@link DEFAULT_PERIOD}
 *  for `null` (absent) or anything not in {@link PERIODS}. */
export function parsePeriod(raw: string | null): Period {
  return (PERIODS as readonly string[]).includes(raw ?? "") ? (raw as Period) : DEFAULT_PERIOD;
}

/** Each period's length in days, the unit the current window (`[to - days, to]`) and its
 *  comparison window are both built from (#164). */
export const PERIOD_DAYS: Record<Period, number> = { "7d": 7, "30d": 30, "90d": 90 };

const DAY_MS = 86_400_000;

/** The window of equal length immediately preceding the current period's `[to - days, to]`,
 *  for the previous-period trend comparison (#164). Ends exactly where the current period
 *  begins, so the two windows never overlap. */
export function previousPeriodWindow(period: Period, to: Date): { readonly from: string; readonly to: string } {
  const days = PERIOD_DAYS[period];
  const currentFrom = new Date(to.getTime() - days * DAY_MS);
  const previousFrom = new Date(currentFrom.getTime() - days * DAY_MS);
  return { from: previousFrom.toISOString(), to: currentFrom.toISOString() };
}
