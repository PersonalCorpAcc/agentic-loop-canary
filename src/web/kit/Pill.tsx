import type { ReactElement, ReactNode } from "react";

import styles from "./Pill.module.css";

export type PillTone = "neutral" | "live" | "attention";

export interface PillProps {
  readonly tone?: PillTone;
  readonly children: ReactNode;
}

/** A small rounded label for a status word: live/reconnecting, an outcome, a route. */
export function Pill({ tone = "neutral", children }: PillProps): ReactElement {
  return <span className={`${styles.pill} ${styles[tone]}`}>{children}</span>;
}
