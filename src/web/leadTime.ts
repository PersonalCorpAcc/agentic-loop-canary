/**
 * Lead-time formatting helper, browser-safe (lead-time-metric 4.1). The fetched
 * `LeadTimeResult` JSON already has everything a page needs computed server-side --
 * this is the only rendering-time transform required: one decimal place, e.g. `"2.3d"`.
 */

export function formatLeadTimeDays(days: number): string {
  return `${days.toFixed(1)}d`;
}
