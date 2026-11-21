// Package routestats groups the loop's runs by route and summarises, over
// the most recent runs, how many ran, their median duration, and how many
// ended asking for a person.
package routestats

import (
	"sort"
	"time"
)

// Run is a single execution of a route.
type Run struct {
	Route          string
	StartedAt      time.Time
	FinishedAt     time.Time
	AskedForPerson bool
}

// Stats summarises the runs of a single route.
type Stats struct {
	Route          string
	Runs           int
	MedianDuration time.Duration
	AskedForPerson int
}

// Summarize groups the most recent n runs (by StartedAt) by route and
// returns their Stats. Duration is always derived from each run's own
// StartedAt and FinishedAt, never from the current time. A route with no
// runs in that window is omitted rather than reported with zero counts.
// The returned slice is ordered by each route's most recent run,
// most recent first.
func Summarize(runs []Run, n int) []Stats {
	recent := mostRecent(runs, n)

	var order []string
	byRoute := make(map[string][]Run, len(recent))
	for _, r := range recent {
		if _, ok := byRoute[r.Route]; !ok {
			order = append(order, r.Route)
		}
		byRoute[r.Route] = append(byRoute[r.Route], r)
	}

	stats := make([]Stats, 0, len(order))
	for _, route := range order {
		rs := byRoute[route]

		durations := make([]time.Duration, len(rs))
		asked := 0
		for i, r := range rs {
			durations[i] = r.FinishedAt.Sub(r.StartedAt)
			if r.AskedForPerson {
				asked++
			}
		}

		stats = append(stats, Stats{
			Route:          route,
			Runs:           len(rs),
			MedianDuration: median(durations),
			AskedForPerson: asked,
		})
	}
	return stats
}

// mostRecent returns the n runs with the latest StartedAt, ordered most
// recent first. If runs has n or fewer elements, all of them are returned.
func mostRecent(runs []Run, n int) []Run {
	sorted := make([]Run, len(runs))
	copy(sorted, runs)
	sort.SliceStable(sorted, func(i, j int) bool {
		return sorted[i].StartedAt.After(sorted[j].StartedAt)
	})
	if n >= 0 && len(sorted) > n {
		sorted = sorted[:n]
	}
	return sorted
}

// median returns the median of durations. For an even count, it is the
// average of the two middle values.
func median(durations []time.Duration) time.Duration {
	if len(durations) == 0 {
		return 0
	}

	sorted := make([]time.Duration, len(durations))
	copy(sorted, durations)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i] < sorted[j] })

	mid := len(sorted) / 2
	if len(sorted)%2 == 1 {
		return sorted[mid]
	}
	return (sorted[mid-1] + sorted[mid]) / 2
}
