package semver

import "testing"

func TestMax(t *testing.T) {
	cases := []struct {
		name   string
		in     []string
		want   string
		wantOK bool
	}{
		{
			name:   "normal slice",
			in:     []string{"1.2.3", "2.0.0", "1.2.3-rc.1", "0.9.9"},
			want:   "2.0.0",
			wantOK: true,
		},
		{
			name:   "single element",
			in:     []string{"1.2.3"},
			want:   "1.2.3",
			wantOK: true,
		},
		{
			name:   "empty",
			in:     []string{},
			wantOK: false,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			versions := mustParseAll(t, c.in)
			original := append([]Version(nil), versions...)

			got, ok := Max(versions)

			if ok != c.wantOK {
				t.Fatalf("Max(%v) ok = %v, want %v", c.in, ok, c.wantOK)
			}
			if ok {
				want, err := Parse(c.want)
				if err != nil {
					t.Fatalf("Parse(%q) returned error: %v", c.want, err)
				}
				if got != want {
					t.Errorf("Max(%v) = %v, want %v", c.in, got, want)
				}
			}
			for i := range versions {
				if versions[i] != original[i] {
					t.Errorf("Max modified the input slice: got %v, want %v", versions, original)
					break
				}
			}
		})
	}
}

func TestMin(t *testing.T) {
	cases := []struct {
		name   string
		in     []string
		want   string
		wantOK bool
	}{
		{
			name:   "normal slice",
			in:     []string{"1.2.3", "2.0.0", "1.2.3-rc.1", "0.9.9"},
			want:   "0.9.9",
			wantOK: true,
		},
		{
			name:   "single element",
			in:     []string{"1.2.3"},
			want:   "1.2.3",
			wantOK: true,
		},
		{
			name:   "empty",
			in:     []string{},
			wantOK: false,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			versions := mustParseAll(t, c.in)
			original := append([]Version(nil), versions...)

			got, ok := Min(versions)

			if ok != c.wantOK {
				t.Fatalf("Min(%v) ok = %v, want %v", c.in, ok, c.wantOK)
			}
			if ok {
				want, err := Parse(c.want)
				if err != nil {
					t.Fatalf("Parse(%q) returned error: %v", c.want, err)
				}
				if got != want {
					t.Errorf("Min(%v) = %v, want %v", c.in, got, want)
				}
			}
			for i := range versions {
				if versions[i] != original[i] {
					t.Errorf("Min modified the input slice: got %v, want %v", versions, original)
					break
				}
			}
		})
	}
}
