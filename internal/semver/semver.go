// Package semver implements parsing, formatting and comparison of a small
// subset of semantic versions: MAJOR.MINOR.PATCH with an optional
// pre-release suffix, and an optional leading "v".
package semver

import (
	"fmt"
	"strconv"
	"strings"
)

// Version is a parsed semantic version.
type Version struct {
	Major, Minor, Patch int
	PreRelease          string
}

// Parse parses a version string such as "1.2.3" or "1.2.3-rc.1", with or
// without a leading "v". It returns an error if s is not in that form.
func Parse(s string) (Version, error) {
	orig := s
	s = strings.TrimPrefix(s, "v")

	core := s
	var pre string
	if i := strings.IndexByte(s, '-'); i >= 0 {
		core = s[:i]
		pre = s[i+1:]
		if pre == "" {
			return Version{}, fmt.Errorf("semver: invalid version %q: empty pre-release", orig)
		}
	}

	parts := strings.Split(core, ".")
	if len(parts) != 3 {
		return Version{}, fmt.Errorf("semver: invalid version %q: expected MAJOR.MINOR.PATCH", orig)
	}

	nums := make([]int, 3)
	for i, p := range parts {
		if p == "" {
			return Version{}, fmt.Errorf("semver: invalid version %q: empty numeric field", orig)
		}
		n, err := strconv.Atoi(p)
		if err != nil {
			return Version{}, fmt.Errorf("semver: invalid version %q: %w", orig, err)
		}
		if n < 0 {
			return Version{}, fmt.Errorf("semver: invalid version %q: negative numeric field", orig)
		}
		nums[i] = n
	}

	return Version{Major: nums[0], Minor: nums[1], Patch: nums[2], PreRelease: pre}, nil
}

// String returns the canonical textual form of v, without a leading "v".
func (v Version) String() string {
	s := fmt.Sprintf("%d.%d.%d", v.Major, v.Minor, v.Patch)
	if v.PreRelease != "" {
		s += "-" + v.PreRelease
	}
	return s
}

// Compare returns -1, 0 or 1 depending on whether a is less than, equal to,
// or greater than b. Numeric fields compare numerically; a pre-release
// version sorts before the same version without one.
func Compare(a, b Version) int {
	if c := compareInt(a.Major, b.Major); c != 0 {
		return c
	}
	if c := compareInt(a.Minor, b.Minor); c != 0 {
		return c
	}
	if c := compareInt(a.Patch, b.Patch); c != 0 {
		return c
	}

	switch {
	case a.PreRelease == "" && b.PreRelease == "":
		return 0
	case a.PreRelease == "":
		return 1
	case b.PreRelease == "":
		return -1
	case a.PreRelease < b.PreRelease:
		return -1
	case a.PreRelease > b.PreRelease:
		return 1
	default:
		return 0
	}
}

func compareInt(a, b int) int {
	switch {
	case a < b:
		return -1
	case a > b:
		return 1
	default:
		return 0
	}
}
