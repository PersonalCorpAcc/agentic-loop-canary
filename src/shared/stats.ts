/**
 * Generic, dependency-free order statistics (#164): `median` and `percentile` over a flat
 * list of numbers. No special-cased minimum sample size -- a set smaller than 5 is still
 * computed, since hiding the result would be a silent gap, not a kindness.
 */

function sorted(values: readonly number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

/** The middle value, or the average of the two middle values for an even-length set. */
export function median(values: readonly number[]): number {
  return percentile(values, 50);
}

/** The `p`th percentile (0-100), linear interpolation between the two nearest ranks --
 *  the same convention as numpy's default and most spreadsheet `PERCENTILE` functions. */
export function percentile(values: readonly number[], p: number): number {
  const xs = sorted(values);
  if (xs.length === 0) return NaN;
  if (xs.length === 1) return xs[0]!;

  const rank = (p / 100) * (xs.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return xs[lower]!;

  const weight = rank - lower;
  return xs[lower]! * (1 - weight) + xs[upper]! * weight;
}
