package semver

import (
	"fmt"
	"strings"
)

// MatchRange reports whether v satisfies the range expression expr.
//
// Supported forms:
//
//	>=1.2.0, >1.2.0, <=2.0.0, <2.0.0, =1.2.3, and bare 1.2.3 (meaning =)
//	^1.2.3 - same major, and at least the given version. For major 0,
//	         ^0.2.3 means same minor and at least the given version.
//	~1.2.3 - same major and minor, and at least the given patch.
//
// It returns an error if expr is not one of those forms.
//
// A pre-release version satisfies a range only when the range expression
// itself names a pre-release: 1.3.0-rc.1 does not satisfy >=1.2.0.
func MatchRange(v Version, expr string) (bool, error) {
	op, rest := splitRangeOperator(expr)

	target, err := Parse(rest)
	if err != nil {
		return false, fmt.Errorf("semver: invalid range %q: %w", expr, err)
	}

	if v.PreRelease != "" && target.PreRelease == "" {
		return false, nil
	}

	switch op {
	case ">=":
		return Compare(v, target) >= 0, nil
	case ">":
		return Compare(v, target) > 0, nil
	case "<=":
		return Compare(v, target) <= 0, nil
	case "<":
		return Compare(v, target) < 0, nil
	case "=":
		return Compare(v, target) == 0, nil
	case "^":
		if target.Major == 0 {
			return v.Major == 0 && v.Minor == target.Minor && Compare(v, target) >= 0, nil
		}
		return v.Major == target.Major && Compare(v, target) >= 0, nil
	case "~":
		return v.Major == target.Major && v.Minor == target.Minor && Compare(v, target) >= 0, nil
	default:
		return false, fmt.Errorf("semver: invalid range %q: unsupported operator", expr)
	}
}

// splitRangeOperator splits a range expression into its operator and the
// remaining version text. A bare version (no operator) is treated as "=".
func splitRangeOperator(expr string) (op, rest string) {
	switch {
	case strings.HasPrefix(expr, ">="):
		return ">=", expr[2:]
	case strings.HasPrefix(expr, "<="):
		return "<=", expr[2:]
	case strings.HasPrefix(expr, ">"):
		return ">", expr[1:]
	case strings.HasPrefix(expr, "<"):
		return "<", expr[1:]
	case strings.HasPrefix(expr, "="):
		return "=", expr[1:]
	case strings.HasPrefix(expr, "^"):
		return "^", expr[1:]
	case strings.HasPrefix(expr, "~"):
		return "~", expr[1:]
	default:
		return "=", expr
	}
}
