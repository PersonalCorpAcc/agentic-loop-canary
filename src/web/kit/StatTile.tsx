import type { ReactElement } from "react";

import styles from "./StatTile.module.css";

export interface StatTileProps {
  readonly label: string;
  readonly value: number | string;
  readonly tone?: "neutral" | "attention";
}

/** A big number with a label under it: the one count a person should see without reading a row. */
export function StatTile({ label, value, tone = "neutral" }: StatTileProps): ReactElement {
  return (
    <div className={`${styles.tile} ${styles[tone]}`}>
      <span className={styles.value}>{value}</span>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
