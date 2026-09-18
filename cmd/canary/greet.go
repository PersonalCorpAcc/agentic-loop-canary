package main

import "fmt"

// Greet returns a greeting for name, falling back to "world" when name is empty.
func Greet(name string) string {
	if name == "" {
		name = "world"
	}
	return fmt.Sprintf("Hello, %s!", name)
}
