/**
 * AsyncBoundary — the loading / error / not-found triad for detail pages
 * (018 T057).
 *
 * RunView and SchemaEditor each hand-rolled the same three guards before
 * rendering their content. This consolidates them into one component
 * parameterised by the entity noun, so the copy ("Loading run…", "Failed to
 * load schema: …", "Run not found.") stays per-page while the structure +
 * styling are shared. Renders `children` once the entity has resolved.
 */
import Typography from "@mui/material/Typography";
import type { JSX, ReactNode } from "react";

import { useStatusTone } from "@/components/primitives";

interface AsyncBoundaryProps {
  /** True while the entity query is in flight. */
  readonly loading: boolean;
  /** Truthy when the query failed — stringified into the error line. */
  readonly error?: unknown;
  /** True when the query resolved but the entity is absent (404-ish). */
  readonly notFound?: boolean;
  /** Lowercase entity noun, e.g. "run" / "schema". */
  readonly entity: string;
  /** Rendered once the entity resolves. Omit when used as a bare early-return
   *  guard (the page continues after the `if (...) return <AsyncBoundary />`). */
  readonly children?: ReactNode;
}

const TEXT_SX = { fontSize: "0.875rem" } as const;

export function AsyncBoundary({
  loading,
  error,
  notFound,
  entity,
  children,
}: AsyncBoundaryProps): JSX.Element {
  const errColor = useStatusTone("err").color;
  if (loading) {
    return <Typography sx={TEXT_SX}>Loading {entity}…</Typography>;
  }
  if (error) {
    return (
      <Typography role="alert" sx={{ ...TEXT_SX, color: errColor }}>
        Failed to load {entity}: {String(error)}
      </Typography>
    );
  }
  if (notFound) {
    const Entity = entity.charAt(0).toUpperCase() + entity.slice(1);
    return <Typography sx={TEXT_SX}>{Entity} not found.</Typography>;
  }
  return <>{children}</>;
}
