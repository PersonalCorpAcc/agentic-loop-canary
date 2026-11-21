package routestats

import (
	"reflect"
	"testing"
	"time"
)

func at(minutes int) time.Time {
	return time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC).Add(time.Duration(minutes) * time.Minute)
}

func run(route string, startMin, durationMin int, askedForPerson bool) Run {
	return Run{
		Route:          route,
		StartedAt:      at(startMin),
		FinishedAt:     at(startMin + durationMin),
		AskedForPerson: askedForPerson,
	}
}

func TestSummarizeGroupsByRoute(t *testing.T) {
	runs := []Run{
		run("implement", 0, 10, false),
		run("review", 5, 4, true),
		run("implement", 20, 30, true),
		run("review", 30, 2, false),
		run("implement", 40, 20, false),
	}

	got := Summarize(runs, 50)

	want := []Stats{
		{Route: "implement", Runs: 3, MedianDuration: 20 * time.Minute, AskedForPerson: 1},
		{Route: "review", Runs: 2, MedianDuration: 3 * time.Minute, AskedForPerson: 1},
	}

	if !reflect.DeepEqual(got, want) {
		t.Errorf("Summarize() = %+v, want %+v", got, want)
	}
}

func TestSummarizeOmitsRouteWithNoRuns(t *testing.T) {
	runs := []Run{
		run("implement", 0, 10, false),
	}

	got := Summarize(runs, 50)

	for _, s := range got {
		if s.Route == "triage" {
			t.Fatalf("route with no runs must be absent, got entry: %+v", s)
		}
	}
	if len(got) != 1 {
		t.Fatalf("Summarize() returned %d routes, want 1", len(got))
	}
}

func TestSummarizeEmptyInput(t *testing.T) {
	got := Summarize(nil, 50)
	if len(got) != 0 {
		t.Errorf("Summarize(nil) = %+v, want empty", got)
	}
}

func TestSummarizeMedianEvenCount(t *testing.T) {
	// Four runs of the same route with durations 10, 20, 30, 40 minutes.
	// The median of an even count is the average of the two middle values.
	runs := []Run{
		run("implement", 0, 10, false),
		run("implement", 20, 40, false),
		run("implement", 70, 20, false),
		run("implement", 100, 30, false),
	}

	got := Summarize(runs, 50)

	if len(got) != 1 {
		t.Fatalf("Summarize() returned %d routes, want 1", len(got))
	}
	want := 25 * time.Minute
	if got[0].MedianDuration != want {
		t.Errorf("MedianDuration = %v, want %v", got[0].MedianDuration, want)
	}
}

func TestSummarizeMedianOddCount(t *testing.T) {
	runs := []Run{
		run("implement", 0, 10, false),
		run("implement", 20, 30, false),
		run("implement", 60, 20, false),
	}

	got := Summarize(runs, 50)

	if len(got) != 1 {
		t.Fatalf("Summarize() returned %d routes, want 1", len(got))
	}
	want := 20 * time.Minute
	if got[0].MedianDuration != want {
		t.Errorf("MedianDuration = %v, want %v", got[0].MedianDuration, want)
	}
}

func TestSummarizeUsesOnlyTheMostRecentN(t *testing.T) {
	runs := []Run{
		run("implement", 0, 999, false), // oldest, should be dropped
		run("implement", 10, 10, false),
		run("implement", 20, 20, false),
	}

	got := Summarize(runs, 2)

	if len(got) != 1 || got[0].Runs != 2 {
		t.Fatalf("Summarize(runs, 2) = %+v, want a single route with 2 runs", got)
	}
	if got[0].MedianDuration == 999*time.Minute {
		t.Errorf("MedianDuration used the dropped, oldest run")
	}
}

func TestSummarizeAskedForPersonCount(t *testing.T) {
	runs := []Run{
		run("triage", 0, 1, true),
		run("triage", 5, 1, true),
		run("triage", 10, 1, false),
	}

	got := Summarize(runs, 50)

	if len(got) != 1 {
		t.Fatalf("Summarize() returned %d routes, want 1", len(got))
	}
	if got[0].AskedForPerson != 2 {
		t.Errorf("AskedForPerson = %d, want 2", got[0].AskedForPerson)
	}
}
