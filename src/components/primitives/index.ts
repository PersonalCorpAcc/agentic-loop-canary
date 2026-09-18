// MUI v6 primitives — themed wrappers around MUI atoms used app-wide.
// palette.status is reached only through Badge / StatusBadge / StatusText /
// useStatusTone (018 R-07); the ESLint rule enforces it everywhere else.
export { AccentLink, type AccentLinkProps } from "./AccentLink";
export { Badge, type BadgeProps } from "./Badge";
export { MicroText, type MicroTextProps } from "./MicroText";
export { StatTile, type StatTileProps } from "./StatTile";
export { StatusBadge, type StatusBadgeProps, type StatusVariant } from "./StatusBadge";
export { StatusText, type StatusTextProps } from "./StatusText";
export {
  useStatusTone,
  useStatusTones,
  type StatusToneStyle,
} from "./useStatusTone";
export { Eyebrow, type EyebrowProps } from "./Eyebrow";
export { Rule, type RuleProps } from "./Rule";
export { LiveDot, type LiveDotProps } from "./LiveDot";
export { Pill, type PillProps, type PillTone } from "./Pill";
export { MetricValue, type MetricValueProps } from "./MetricValue";
export { CopyButton, type CopyButtonProps } from "./CopyButton";
// 080 — the History row's "this has a recorded failure" marker. Built on
// useStatusTone, so it is a sanctioned palette.status consumer like the rest.
export { ErrorMarker, type ErrorMarkerProps } from "./ErrorMarker";
export { HelperText, type HelperTextProps } from "./HelperText";
export {
  RailNode,
  type RailNodeProps,
  type RailNodeVariant,
} from "./RailNode";
export {
  TooltipIconButton,
  type TooltipIconButtonProps,
} from "./TooltipIconButton";
