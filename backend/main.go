package main

// Aremko CLI - Management tool for Aremko Spa business operations
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
