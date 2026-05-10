package main

import (
	"fmt"
	"os"

	"github.com/aremko/aremko-cli/cmd/aremko"
)

func main() {
	if err := aremko.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
