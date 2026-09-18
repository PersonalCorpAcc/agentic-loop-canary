package semver

import "testing"

func TestParse(t *testing.T) {
	cases := []struct {
		in   string
		want Version
	}{
		{"1.2.3", Version{1, 2, 3, ""}},
		{"v1.2.3", Version{1, 2, 3, ""}},
		{"1.2.3-rc.1", Version{1, 2, 3, "rc.1"}},
	}
	for _, c := range cases {
		got, err := Parse(c.in)
		if err != nil {
			t.Fatalf("Parse(%q) returned error: %v", c.in, err)
		}
		if got != c.want {
			t.Errorf("Parse(%q) = %+v, want %+v", c.in, got, c.want)
		}
	}
}

func TestParseError(t *testing.T) {
	cases := []string{
		"",
		"1.2",
		"1.2.3.4",
		"a.b.c",
		"1.2.-3",
		"1.2.3-",
	}
	for _, in := range cases {
		if _, err := Parse(in); err == nil {
			t.Errorf("Parse(%q) = nil error, want an error", in)
		}
	}
}

func TestString(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"1.2.3", "1.2.3"},
		{"v1.2.3", "1.2.3"},
		{"1.2.3-rc.1", "1.2.3-rc.1"},
	}
	for _, c := range cases {
		v, err := Parse(c.in)
		if err != nil {
			t.Fatalf("Parse(%q) returned error: %v", c.in, err)
		}
		if got := v.String(); got != c.want {
			t.Errorf("Parse(%q).String() = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestCompare(t *testing.T) {
	cases := []struct {
		a, b string
		want int
	}{
		{"1.2.3", "1.2.3", 0},
		{"1.2.3", "1.2.4", -1},
		{"1.2.4", "1.2.3", 1},
		{"1.2.3", "1.3.0", -1},
		{"1.2.3", "2.0.0", -1},
		{"1.2.3-rc.1", "1.2.3", -1},
		{"1.2.3", "1.2.3-rc.1", 1},
		{"1.2.3-rc.1", "1.2.3-rc.2", -1},
		{"1.2.3-rc.1", "1.2.3-rc.1", 0},
	}
	for _, c := range cases {
		a, err := Parse(c.a)
		if err != nil {
			t.Fatalf("Parse(%q) returned error: %v", c.a, err)
		}
		b, err := Parse(c.b)
		if err != nil {
			t.Fatalf("Parse(%q) returned error: %v", c.b, err)
		}
		if got := Compare(a, b); got != c.want {
			t.Errorf("Compare(%q, %q) = %d, want %d", c.a, c.b, got, c.want)
		}
	}
}

func TestCompareStrings(t *testing.T) {
	cases := []struct {
		name    string
		a, b    string
		want    int
		wantErr bool
	}{
		{name: "less than", a: "1.2.3", b: "1.2.4", want: -1},
		{name: "equal", a: "1.2.3", b: "1.2.3", want: 0},
		{name: "greater than", a: "1.2.4", b: "1.2.3", want: 1},
		{name: "invalid a", a: "not-a-version", b: "1.2.3", wantErr: true},
		{name: "invalid b", a: "1.2.3", b: "not-a-version", wantErr: true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := CompareStrings(c.a, c.b)
			if c.wantErr {
				if err == nil {
					t.Fatalf("CompareStrings(%q, %q) returned nil error, want an error", c.a, c.b)
				}
				return
			}
			if err != nil {
				t.Fatalf("CompareStrings(%q, %q) returned unexpected error: %v", c.a, c.b, err)
			}
			if got != c.want {
				t.Errorf("CompareStrings(%q, %q) = %d, want %d", c.a, c.b, got, c.want)
			}
		})
	}
}
