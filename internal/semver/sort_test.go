package semver

import (
	"reflect"
	"testing"
)

func mustParseAll(t *testing.T, in []string) []Version {
	t.Helper()
	out := make([]Version, len(in))
	for i, s := range in {
		v, err := Parse(s)
		if err != nil {
			t.Fatalf("Parse(%q) returned error: %v", s, err)
		}
		out[i] = v
	}
	return out
}

func TestSort(t *testing.T) {
	cases := []struct {
		name string
		in   []string
		want []string
	}{
		{
			name: "unsorted with pre-release",
			in:   []string{"1.2.3", "1.0.0", "1.2.3-rc.1", "2.0.0"},
			want: []string{"1.0.0", "1.2.3-rc.1", "1.2.3", "2.0.0"},
		},
		{
			name: "already sorted",
			in:   []string{"1.0.0", "1.2.0", "1.2.3", "2.0.0"},
			want: []string{"1.0.0", "1.2.0", "1.2.3", "2.0.0"},
		},
		{
			name: "empty",
			in:   []string{},
			want: []string{},
		},
		{
			name: "single element",
			in:   []string{"1.2.3"},
			want: []string{"1.2.3"},
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			versions := mustParseAll(t, c.in)
			want := mustParseAll(t, c.want)

			Sort(versions)

			if !reflect.DeepEqual(versions, want) {
				t.Errorf("Sort(%v) = %v, want %v", c.in, versions, want)
			}
		})
	}
}

func TestSortStable(t *testing.T) {
	type tagged struct {
		v   Version
		tag int
	}

	in := []tagged{
		{Version{1, 0, 0, ""}, 0},
		{Version{1, 0, 0, ""}, 1},
		{Version{0, 9, 0, ""}, 2},
		{Version{1, 0, 0, ""}, 3},
	}

	versions := make([]Version, len(in))
	for i, e := range in {
		versions[i] = e.v
	}

	Sort(versions)

	// After sorting, the three equal 1.0.0 entries must still appear in
	// their original relative order: tags 0, 1, 3.
	used := make([]bool, len(in))
	var order []int
	for _, v := range versions {
		for i, e := range in {
			if !used[i] && v == e.v {
				used[i] = true
				order = append(order, e.tag)
				break
			}
		}
	}

	want := []int{2, 0, 1, 3}
	if !reflect.DeepEqual(order, want) {
		t.Errorf("Sort did not preserve relative order of equal elements: got tag order %v, want %v", order, want)
	}
}
