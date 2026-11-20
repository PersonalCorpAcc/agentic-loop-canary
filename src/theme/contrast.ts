/**
 * WCAG 2.x relative-luminance contrast, used to verify the dark palette tokens in
 * `palette.ts` against the thresholds the issue that added dark mode asked for
 * (4.5:1 body text, 3:1 large text/UI) rather than trusting a hand-picked hex by eye.
 */

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (match === null) throw new Error(`not a 6-digit hex colour: ${hex}`);
  const [, r, g, b] = match as unknown as [string, string, string, string];
  const [lr, lg, lb] = [r, g, b].map((part) => srgbToLinear(Number.parseInt(part, 16)));
  return 0.2126 * lr! + 0.7152 * lg! + 0.0722 * lb!;
}

/** WCAG contrast ratio between two colours, order-independent, from 1 (identical) to 21. */
export function contrastRatio(a: string, b: string): number {
  const [la, lb] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (la! + 0.05) / (lb! + 0.05);
}

/** True when `fg` on `bg` clears the AA threshold for the given text size. */
export function meetsAA(fg: string, bg: string, size: "body" | "large" = "body"): boolean {
  return contrastRatio(fg, bg) >= (size === "body" ? 4.5 : 3);
}
