package semver

import "testing"

func TestMatchRange(t *testing.T) {
	cases := []struct {
		v, expr string
		want    bool
	}{
		// >=
		{"1.2.0", ">=1.2.0", true},
		{"1.2.1", ">=1.2.0", true},
		{"1.1.9", ">=1.2.0", false},
		// >
		{"1.2.1", ">1.2.0", true},
		{"1.2.0", ">1.2.0", false},
		// <=
		{"2.0.0", "<=2.0.0", true},
		{"1.9.9", "<=2.0.0", true},
		{"2.0.1", "<=2.0.0", false},
		// <
		{"1.9.9", "<2.0.0", true},
		{"2.0.0", "<2.0.0", false},
		// = and bare
		{"1.2.3", "=1.2.3", true},
		{"1.2.4", "=1.2.3", false},
		{"1.2.3", "1.2.3", true},
		{"1.2.4", "1.2.3", false},
		// ^ for major >= 1: same major, at least given version
		{"1.2.3", "^1.2.3", true},
		{"1.9.0", "^1.2.3", true},
		{"1.2.2", "^1.2.3", false},
		{"2.0.0", "^1.2.3", false},
		// ^ for major 0: same minor, at least given version
		{"0.2.3", "^0.2.3", true},
		{"0.2.9", "^0.2.3", true},
		{"0.2.2", "^0.2.3", false},
		{"0.3.0", "^0.2.3", false},
		{"1.0.0", "^0.2.3", false},
		// ~: same major and minor, at least given patch
		{"1.2.3", "~1.2.3", true},
		{"1.2.9", "~1.2.3", true},
		{"1.2.2", "~1.2.3", false},
		{"1.3.0", "~1.2.3", false},
		{"2.2.3", "~1.2.3", false},
		// pre-release exclusion: a pre-release version only satisfies a
		// range whose own expression names a pre-release.
		{"1.3.0-rc.1", ">=1.2.0", false},
		{"1.2.0-rc.1", "^1.2.0", false},
		{"1.2.0-rc.1", ">=1.2.0-rc.1", true},
		{"1.2.0-rc.1", ">=1.2.0-rc.0", true},
		{"1.2.0-rc.1", "=1.2.0-rc.1", true},
	}
	for _, c := range cases {
		v, err := Parse(c.v)
		if err != nil {
			t.Fatalf("Parse(%q) returned error: %v", c.v, err)
		}
		got, err := MatchRange(v, c.expr)
		if err != nil {
			t.Fatalf("MatchRange(%q, %q) returned error: %v", c.v, c.expr, err)
		}
		if got != c.want {
			t.Errorf("MatchRange(%q, %q) = %v, want %v", c.v, c.expr, got, c.want)
		}
	}
}

func TestMatchRangeError(t *testing.T) {
	cases := []string{
		"",
		"1.2",
		">=",
		">= 1.2.0",
		"!=1.2.0",
		"^^1.2.0",
		"1.2.x",
	}
	v, err := Parse("1.2.3")
	if err != nil {
		t.Fatalf("Parse(%q) returned error: %v", "1.2.3", err)
	}
	for _, expr := range cases {
		if _, err := MatchRange(v, expr); err == nil {
			t.Errorf("MatchRange(v, %q) = nil error, want an error", expr)
		}
	}
}
