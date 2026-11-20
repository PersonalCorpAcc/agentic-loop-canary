/**
 * ChartSkeleton — a chart's empty state (#159's rule, applied to #164's trend charts): a zero
 * shipped items in a period renders a skeleton shaped like the chart that would otherwise be
 * there, never a flat zero-value chart that reads as "working, nothing happened."
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
      <Skeleton variant="rectangular" height={height} sx={{ borderRadius: 1 }} />
      <HelperText>{message}</HelperText>
    </Stack>
  );
}
