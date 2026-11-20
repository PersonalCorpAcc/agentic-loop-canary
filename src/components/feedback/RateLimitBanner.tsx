import { useEffect, useState, type ReactElement } from "react";

import { StatusText } from "@/components/primitives";

/** The forge's own rate limit, read back from `/api/rate-limit` -- which never triggers a
 *  live forge fetch itself -- rather than this component polling the forge directly. Renders
 *  nothing once the pause has cleared, and a quiet "data paused until HH:MM" while it hasn't.
 *  Polls on the same 30s interval `Log.tsx`'s stage-freeze banner uses: a pause clearing is
 *  exactly the kind of state nothing else on the page is guaranteed to trigger a refetch
 *  for. */
export function RateLimitBanner(): ReactElement | null {
  const [pausedUntil, setPausedUntil] = useState<string | null>(null);

  useEffect(() => {
    const fetchRateLimit = (): void => {
      fetch("/api/rate-limit")
        .then((response) => response.json() as Promise<{ pausedUntil: string | null }>)
        .then((body) => setPausedUntil(body.pausedUntil))
        .catch(() => setPausedUntil(null));
    };
    fetchRateLimit();
    const interval = setInterval(fetchRateLimit, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (pausedUntil === null || Date.parse(pausedUntil) <= Date.now()) return null;

  const until = new Date(pausedUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return <StatusText variant="warn">data paused until {until}</StatusText>;
}
