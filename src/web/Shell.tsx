import { useEffect, useState, type ReactElement } from "react";
import { Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";

import { RailFrame } from "@/components/layout";
import { RailNode } from "@/components/primitives";
import { DEFAULT_PERIOD, PERIODS, PERIOD_LABELS, parsePeriod, type Period } from "../shared/period.js";
import type { RepoRef } from "../shared/repo.js";

const NAV_RAIL_WIDTH = 240;

interface NavEntry {
  readonly label: string;
  readonly path: string;
}

const NAV_ENTRIES: readonly NavEntry[] = [
  { label: "Overview", path: "/" },
  { label: "Delivery", path: "/delivery" },
  { label: "Changes", path: "/changes" },
  { label: "Log", path: "/log" },
];

/** The dashboard shell (#142): a dark nav rail on the left, a top bar (watched repository +
 *  period selector) above the routed page, built once so every child route — Overview,
 *  Delivery, the retired log view at `/loop` — shares the same chrome. */
export function Shell(): ReactElement {
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

interface RateLimitStatus {
  readonly paused: boolean;
  readonly pausedUntil: string | null;
}

/** How often the top bar checks whether polling has paused for the rate limit (#207) -- the
 *  banner only needs to track a pause that lasts minutes, not seconds. */
const RATE_LIMIT_POLL_MS = 30_000;

function TopBar(): ReactElement {
  const [repo, setRepo] = useState<RepoRef | null | undefined>(undefined);
  const [rateLimit, setRateLimit] = useState<RateLimitStatus | undefined>(undefined);

  useEffect(() => {
    fetch("/api/repo")
      .then((response) => response.json() as Promise<RepoRef>)
      .then(setRepo)
      .catch(() => setRepo(null));
  }, []);

  useEffect(() => {
    const poll = () => {
      fetch("/api/rate-limit")
        .then((response) => response.json() as Promise<RateLimitStatus>)
        .then(setRateLimit)
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, RATE_LIMIT_POLL_MS);
    return () => clearInterval(interval);
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
      <Stack direction="row" alignItems="center" spacing={2}>
        <Typography variant="body2" sx={(theme) => ({ color: theme.palette.text.secondary })}>
          {repo === undefined ? "" : repo === null ? "repository unavailable" : `${repo.owner}/${repo.name}`}
        </Typography>
        {rateLimit?.paused === true && rateLimit.pausedUntil !== null && (
          <Typography variant="body2" sx={(theme) => ({ color: theme.palette.text.disabled })}>
            data paused until {formatPausedUntil(rateLimit.pausedUntil)}
          </Typography>
        )}
      </Stack>
      <PeriodSelector />
    </Stack>
  );
}

/** `HH:MM` in the viewer's own local time, out of the ISO timestamp `/api/rate-limit` reports. */
function formatPausedUntil(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
