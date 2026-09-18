import type { ReactElement, ReactNode } from "react";

import styles from "./Table.module.css";

export interface Column<T> {
  readonly key: string;
  readonly header: string;
  readonly render: (row: T) => ReactNode;
}

export interface TableProps<T> {
  readonly columns: readonly Column<T>[];
  readonly rows: readonly T[];
  readonly rowKey: (row: T) => string | number;
  /** When given, the row's first cell links here -- how a row reaches its run on GitHub. */
  readonly rowHref?: (row: T) => string;
  readonly emptyMessage?: string;
}

/** A themed table: the kit's one way to show rows of runs, so no screen reinvents it. */
export function Table<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  emptyMessage = "Nothing here yet.",
}: TableProps<T>): ReactElement {
  if (rows.length === 0) {
    return <p className={styles.empty}>{emptyMessage}</p>;
  }

  return (
    <div className={styles.scroller}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const href = rowHref?.(row);
            return (
              <tr key={rowKey(row)}>
                {columns.map((column, index) => (
                  <td key={column.key}>
                    {index === 0 && href !== undefined ? <a href={href}>{column.render(row)}</a> : column.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
