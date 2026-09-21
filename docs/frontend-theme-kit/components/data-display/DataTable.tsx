/**
 * DataTable — the reusable, themed table for the app (018 US5).
 *
 * Built on MUI's base Table primitives (NOT MUI X DataGrid) so it inherits
 * the reference table chrome straight from the theme (`MuiTableHead` slate-50
 * band, `MuiTableCell` head = 12/500 slate-500, 14px body rows, slate-100
 * dividers). One source of truth for tabular data across pages.
 *
 * Per-column flags drive behaviour:
 *   - `sortable`   → header becomes a clickable sort toggle (client-side).
 *   - `searchable` → the column's text feeds the optional global search box.
 *
 * The root always flexes to fill its parent's height regardless of row
 * count — the card stretches, the body scrolls, the header stays stuck and
 * the pagination bar pins to the bottom.
 *
 * Pagination is optional and controlled (pass `pagination` for server-side
 * paging; omit it to render every row). When server-paged, sorting/search
 * apply to the current page only, so mark such columns non-sortable/
 * -searchable unless the backend also sorts/filters.
 *
 * Two distinct loading states, matching the DataGrid's own convention:
 *   - `loading` (first load, nothing to show yet) → SKELETON rows, so the
 *     card is already its final size and nothing jumps when data lands.
 *   - `fetching` (a page/refetch with rows already on screen) → a linear
 *     progress bar under the header plus a dimmed, non-interactive body.
 *     Replacing the rows with a spinner here would collapse the table and
 *     read as "empty" rather than "loading".
 */
import Box from "@mui/material/Box";
import InputAdornment from "@mui/material/InputAdornment";
import LinearProgress from "@mui/material/LinearProgress";
import Skeleton from "@mui/material/Skeleton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMemo, useState, type JSX, type ReactNode } from "react";

export interface DataTableColumn<R> {
  /** Stable column id (also the sort key). */
  readonly id: string;
  readonly header: ReactNode;
  /** Cell renderer. Falls back to `String(value(row))` when omitted. */
  readonly render?: (row: R) => ReactNode;
  /** Comparable/searchable scalar for the row. Required for sort/search. */
  readonly value?: (row: R) => string | number | null | undefined;
  readonly sortable?: boolean;
  readonly searchable?: boolean;
  readonly align?: "left" | "right" | "center";
  readonly width?: number | string;
}

export interface DataTablePagination {
  readonly page: number;
  readonly pageSize: number;
  readonly rowCount: number;
  readonly onChange: (page: number, pageSize: number) => void;
  readonly pageSizeOptions?: readonly number[];
}

export interface DataTableProps<R> {
  readonly rows: readonly R[];
  readonly columns: ReadonlyArray<DataTableColumn<R>>;
  readonly getRowId: (row: R) => string;
  readonly onRowClick?: (row: R) => void;
  /** First load — renders skeleton rows in place of the (absent) data. */
  readonly loading?: boolean;
  /** A refetch with rows already on screen (paging, poll, invalidation) —
   *  keeps them visible under a progress bar instead of blanking the table. */
  readonly fetching?: boolean;
  /** Skeleton row count for the `loading` state. Defaults to the page size
   *  when paginated so the card lands at its final height immediately. */
  readonly skeletonRows?: number;
  readonly emptyMessage?: ReactNode;
  /** Show a global search box filtering the `searchable` columns. */
  readonly searchable?: boolean;
  readonly searchPlaceholder?: string;
  readonly initialSort?: { columnId: string; direction: "asc" | "desc" };
  /** Controlled server-side pagination. Omit to render every row. */
  readonly pagination?: DataTablePagination;
}

function cellText(value: string | number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

/** Skeleton stand-ins for the first load — one bar per cell, so column
 *  widths and row height match the real table exactly. */
function SkeletonRows<R>({
  columns,
  count,
}: Readonly<{ columns: ReadonlyArray<DataTableColumn<R>>; count: number }>): JSX.Element {
  return (
    <>
      {Array.from({ length: count }, (_, rowIndex) => (
        <TableRow key={`skeleton-${rowIndex}`}>
          {columns.map((col) => (
            <TableCell key={col.id} {...(col.align ? { align: col.align } : {})}>
              <Skeleton variant="text" width="70%" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function DataTable<R>({
  rows,
  columns,
  getRowId,
  onRowClick,
  loading = false,
  fetching = false,
  skeletonRows,
  emptyMessage = "No rows.",
  searchable = false,
  searchPlaceholder = "Search…",
  initialSort,
  pagination,
}: DataTableProps<R>): JSX.Element {
  const [sort, setSort] = useState<{ columnId: string; direction: "asc" | "desc" } | null>(
    initialSort ?? null,
  );
  const [query, setQuery] = useState("");

  const searchableCols = useMemo(
    () => columns.filter((c) => c.searchable && c.value),
    [columns],
  );

  const visibleRows = useMemo(() => {
    let out = [...rows];
    const q = query.trim().toLowerCase();
    if (q && searchableCols.length > 0) {
      out = out.filter((row) =>
        searchableCols.some((c) => cellText(c.value?.(row)).toLowerCase().includes(q)),
      );
    }
    if (sort) {
      const col = columns.find((c) => c.id === sort.columnId);
      if (col?.value) {
        const dir = sort.direction === "asc" ? 1 : -1;
        out.sort((a, b) => {
          const av = col.value?.(a);
          const bv = col.value?.(b);
          if (av === bv) return 0;
          if (av === null || av === undefined) return 1;
          if (bv === null || bv === undefined) return -1;
          return av < bv ? -dir : dir;
        });
      }
    }
    return out;
  }, [rows, query, searchableCols, sort, columns]);

  const toggleSort = (columnId: string): void => {
    setSort((prev) =>
      prev?.columnId === columnId
        ? { columnId, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { columnId, direction: "asc" },
    );
  };

  const colSpan = columns.length;
  const busy = loading || fetching;
  const skeletonRowCount = skeletonRows ?? pagination?.pageSize ?? 10;

  return (
    <Box
      sx={(theme) => ({
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        borderRadius: 1,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        boxShadow: theme.shadows[1],
        overflow: "hidden",
      })}
    >
      {searchable ? (
        <Box sx={(theme) => ({ p: 2, borderBottom: `1px solid ${theme.palette.divider}` })}>
          <TextField
            size="small"
            fullWidth
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            slotProps={{
              input: {
                startAdornment: <InputAdornment position="start">⌕</InputAdornment>,
              },
            }}
          />
        </Box>
      ) : null}

      {/* Refetch indicator. The 2px strip is ALWAYS in the layout (empty when
          idle) so the bar appearing mid-page never nudges the rows. */}
      <Box sx={{ height: 2, flexShrink: 0 }}>
        {busy ? (
          <LinearProgress aria-label="Loading rows" sx={{ height: 2 }} />
        ) : null}
      </Box>

      <TableContainer
        sx={{
          flex: 1,
          minHeight: 0,
          // Dim + lock the stale rows during a refetch: they stay readable
          // for context but read as "not the answer yet".
          ...(fetching && !loading
            ? { opacity: 0.5, pointerEvents: "none", transition: "opacity 120ms" }
            : { transition: "opacity 120ms" }),
        }}
        aria-busy={busy}
      >
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell
                  key={col.id}
                  {...(col.align ? { align: col.align } : {})}
                  {...(col.width !== undefined ? { sx: { width: col.width } } : {})}
                  sortDirection={sort?.columnId === col.id ? sort.direction : false}
                >
                  {col.sortable && col.value ? (
                    <TableSortLabel
                      active={sort?.columnId === col.id}
                      direction={sort?.columnId === col.id ? sort.direction : "asc"}
                      onClick={() => toggleSort(col.id)}
                    >
                      {col.header}
                    </TableSortLabel>
                  ) : (
                    col.header
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <SkeletonRows columns={columns} count={skeletonRowCount} />
            ) : visibleRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} align="center" sx={{ py: 8, border: 0 }}>
                  <Typography variant="body2" color="text.secondary">
                    {emptyMessage}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((row) => (
                <TableRow
                  key={getRowId(row)}
                  hover={Boolean(onRowClick)}
                  {...(onRowClick
                    ? { onClick: () => onRowClick(row), sx: { cursor: "pointer" } }
                    : {})}
                >
                  {columns.map((col) => (
                    <TableCell key={col.id} {...(col.align ? { align: col.align } : {})}>
                      {col.render ? col.render(row) : cellText(col.value?.(row))}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {pagination ? (
        <TablePagination
          component="div"
          count={pagination.rowCount}
          page={pagination.page}
          rowsPerPage={pagination.pageSize}
          rowsPerPageOptions={[...(pagination.pageSizeOptions ?? [25, 50, 100])]}
          onPageChange={(_e, page) => pagination.onChange(page, pagination.pageSize)}
          onRowsPerPageChange={(e) =>
            pagination.onChange(0, parseInt(e.target.value, 10))
          }
          sx={(theme) => ({ borderTop: `1px solid ${theme.palette.divider}`, flexShrink: 0 })}
        />
      ) : null}
    </Box>
  );
}
