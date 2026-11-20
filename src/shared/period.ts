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
