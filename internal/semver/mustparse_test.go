package semver

import "testing"

func TestMustParse(t *testing.T) {
	got := MustParse("1.2.3-rc.1")
	want := Version{Major: 1, Minor: 2, Patch: 3, PreRelease: "rc.1"}
	if got != want {
		t.Fatalf("MustParse(%q) = %+v, want %+v", "1.2.3-rc.1", got, want)
	}
}

func TestMustParsePanicsOnInvalid(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Fatal("MustParse did not panic on invalid input")
		}
	}()
	MustParse("not-a-version")
}
