package semver

import "sort"

// Sort sorts versions in place in ascending order, using Compare. Versions
// that compare equal keep their relative order.
func Sort(versions []Version) {
	sort.SliceStable(versions, func(i, j int) bool {
		return Compare(versions[i], versions[j]) < 0
	})
}
