package semver

// MustParse parses s like Parse but panics if s is not a valid version. It is
// intended for table-driven tests where the input is a literal the author
// controls.
func MustParse(s string) Version {
	v, err := Parse(s)
	if err != nil {
		panic(err)
	}
	return v
}
