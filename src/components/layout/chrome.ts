/**
 * AppShell chrome dimensions — the single source of truth for "how much
 * vertical space is NOT the page".
 *
 * Pages that want to fill the viewport (History, Review — anything whose
 * body is a scrolling table) used to hardcode `calc(100vh - 240px)`. That
 * number was guesswork: the real chrome is ~175px, and `<main>` reserved
 * 160px of bottom padding for a ~57px footer. The surplus showed up as dead
 * space under the table.
 *
 * `AppShell` derives its own header/footer/padding from these constants AND
 * publishes their sum as the `--rp-chrome-h` CSS variable, so `FILL_HEIGHT`
 * stays correct if any one of them changes.
 */

/** Header band: 24px vertical padding × 2 + 32px tallest child + 1px rule. */
export const HEADER_BAND_H = 81;

/** The sage strip under the header band. */
export const HEADER_STRIP_H = 4;

/** Fixed footer: 20px vertical padding × 2 + ~16px label line + 1px rule. */
export const FOOTER_H = 57;

/** `<main>`'s top padding (theme spacing 4). */
export const MAIN_PT = 32;

/**
 * Total non-page chrome. `<main>`'s bottom padding is exactly FOOTER_H (the
 * footer is `position: fixed`, so the padding is what keeps content clear of
 * it) — hence it appears in this sum too.
 */
export const CHROME_H = HEADER_BAND_H + HEADER_STRIP_H + MAIN_PT + FOOTER_H;

/**
 * `sx` fragment for a page that should fill the viewport exactly, with its
 * own body scrolling rather than the window. Reads the CSS variable AppShell
 * publishes so the value is resolved at paint time, not build time.
 */
export const FILL_HEIGHT = {
  height: `calc(100vh - var(--rp-chrome-h, ${CHROME_H}px))`,
  minHeight: 360,
} as const;
