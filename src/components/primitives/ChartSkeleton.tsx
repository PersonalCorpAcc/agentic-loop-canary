/**
 * ChartSkeleton — the shared empty-state for trend charts with zero items in
 * the period (#159: a skeleton-shaped placeholder, never a flat zero-line
 * chart, since a flat line reads as "nothing changed" rather than "no data").
 */
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import type { JSX } from "react";

import { HelperText } from "./HelperText";

export interface ChartSkeletonProps {
  readonly height?: number;
  readonly message?: string;
}

export function ChartSkeleton({
  height = 240,
  message = "No shipped items in this period",
}: ChartSkeletonProps): JSX.Element {
  return (
    <Stack spacing={1}>
      <Skeleton variant="rectangular" height={height} />
      <HelperText>{message}</HelperText>
    </Stack>
  );
}
