package semver

import "testing"

// Deliberately failing, to prove the merge gate refuses to merge on a red CI run
// while auto-merge is on (T216). Delete with the branch.
func TestRedCIOnPurpose(t *testing.T) {
	if Compare(Version{Major: 1}, Version{Major: 1}) != 99 {
		t.Fatal("this test fails on purpose so CI goes red")
	}
}
