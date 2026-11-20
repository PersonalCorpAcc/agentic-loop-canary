import { useEffect, useState, type ReactElement } from "react";
import { Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { RailFrame } from "@/components/layout";
import { RailNode } from "@/components/primitives";
import { DEFAULT_PERIOD, PERIODS, PERIOD_LABELS, parsePeriod, type Period } from "../shared/period.js";
import type { RepoRef } from "../shared/repo.js";

const NAV_RAIL_WIDTH = 240;

/** `?tv=1` → on, mirroring `period.ts`'s own `parsePeriod` validate-or-fall-back shape, just
 *  for a boolean instead of an enum (#162). */
export function parseTv(raw: string | null): boolean {
  return raw === "1";
}

interface NavEntry {
  readonly label: string;
  readonly path: string;
}

const NAV_ENTRIES: readonly NavEntry[] = [
  { label: "Overview", path: "/" },
  { label: "Delivery", path: "/delivery" },
  { label: "Log", path: "/log" },
];

/** The dashboard shell (#142): a dark nav rail on the left, a top bar (watched repository +
 *  period selector) above the routed page, built once so every child route — Overview,
 *  Delivery, the retired log view at `/loop` — shares the same chrome. */
export function Shell(): ReactElement {
  const [searchParams] = useSearchParams();
  const tv = parseTv(searchParams.get("tv"));

  if (tv) {
    return (
      <Box sx={{ position: "relative", height: "100vh", minHeight: 0 }}>
        <Box sx={{ height: "100%", minHeight: 0, overflow: "auto" }}>
          <Outlet />
        </Box>
        <ExitTvButton />
      </Box>
    );
  }

  return (
    <Stack direction="row" sx={{ height: "100vh", minHeight: 0 }}>
      <Box sx={{ width: NAV_RAIL_WIDTH, flexShrink: 0, p: 1 }}>
        <RailFrame header={<NavRailHeader />}>
          <NavRail />
        </RailFrame>
      </Box>
      <Stack sx={{ flex: 1, minHeight: 0 }}>
        <TopBar />
        <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", p: 4 }}>
          <Outlet />
        </Box>
      </Stack>
    </Stack>
  );
}

/** Always-reachable way out of TV mode (#162) — a small floating button rather than relying on
 *  the back button, since TV mode strips every other piece of chrome from the viewport. */
function ExitTvButton(): ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();

  const exitTv = (): void => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("tv");
      return next;
    });
  };

  return (
    <Tooltip title="Exit TV mode">
      <IconButton
        onClick={exitTv}
        aria-label="Exit TV mode"
        size="small"
        sx={(theme) => ({
          position: "absolute",
          top: 8,
          right: 8,
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          "&:hover": { backgroundColor: theme.palette.action.hover },
        })}
      >
        ✕
      </IconButton>
    </Tooltip>
  );
}

function NavRailHeader(): ReactElement {
  return (
    <Typography variant="eyebrow" component="div" sx={{ px: 1.5, py: 1 }}>
      loopscope
    </Typography>
  );
}

function NavRail(): ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <Stack spacing={0.25}>
      {NAV_ENTRIES.map((entry) => {
        const active = entry.path === "/" ? location.pathname === "/" : location.pathname.startsWith(entry.path);
        return (
          <RailNode
            key={entry.path}
            label={entry.label}
            selected={active}
            onClick={() => navigate(entry.path)}
          />
        );
      })}
    </Stack>
  );
}

function TopBar(): ReactElement {
  const [repo, setRepo] = useState<RepoRef | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/repo")
      .then((response) => response.json() as Promise<RepoRef>)
      .then(setRepo)
      .catch(() => setRepo(null));
  }, []);

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={(theme) => ({
        flexShrink: 0,
        px: 4,
        py: 2,
        borderBottom: `1px solid ${theme.palette.divider}`,
      })}
    >
      <Typography variant="body2" sx={(theme) => ({ color: theme.palette.text.secondary })}>
        {repo === undefined ? "" : repo === null ? "repository unavailable" : `${repo.owner}/${repo.name}`}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center">
        <PeriodSelector />
        <TvModeButton />
      </Stack>
    </Stack>
  );
}

function TvModeButton(): ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();

  const enterTv = (): void => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("tv", "1");
      return next;
    });
  };

  return (
    <Tooltip title="TV mode">
      <IconButton onClick={enterTv} aria-label="Enter TV mode" size="small">
        ⛶
      </IconButton>
    </Tooltip>
  );
}

function PeriodSelector(): ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const period = parsePeriod(searchParams.get("period"));

  useEffect(() => {
    if (searchParams.get("period") === null) {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.set("period", DEFAULT_PERIOD);
          return next;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);

  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={period}
      onChange={(_event, next: Period | null) => {
        if (next === null) return;
        setSearchParams((current) => {
          const params = new URLSearchParams(current);
          params.set("period", next);
          return params;
        });
      }}
    >
      {PERIODS.map((value) => (
        <ToggleButton key={value} value={value}>
          {PERIOD_LABELS[value]}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
