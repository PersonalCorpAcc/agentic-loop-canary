package semver

// Max returns the greatest version in versions, using Compare. It reports
// false if versions is empty. The input slice is not modified.
func Max(versions []Version) (Version, bool) {
	if len(versions) == 0 {
		return Version{}, false
	}
	max := versions[0]
	for _, v := range versions[1:] {
		if Compare(v, max) > 0 {
			max = v
		}
	}
	return max, true
}

// Min returns the least version in versions, using Compare. It reports
// false if versions is empty. The input slice is not modified.
func Min(versions []Version) (Version, bool) {
	if len(versions) == 0 {
		return Version{}, false
	}
	min := versions[0]
	for _, v := range versions[1:] {
		if Compare(v, min) < 0 {
			min = v
		}
	}
	return min, true
}
