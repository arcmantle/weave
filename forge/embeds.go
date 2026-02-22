// Package forge provides the embedded Go helpers filesystem.
//
// This file exists at the module root so that //go:embed can reach
// the helpers/ sub-directory directly, eliminating the need for a
// copied set of helpers inside internal/embedded/.
package forge

import "embed"

// GoHelpersFS contains the Go helpers source files.
// Embedded from the canonical forge/helpers/ package.
//
//go:embed helpers/*.go
var GoHelpersFS embed.FS
