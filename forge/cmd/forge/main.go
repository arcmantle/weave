package main

import (
	"os"

	"github.com/arcmantle/forge/cmd/forge/commands"
)

// version is set at build time via -ldflags.
var version = "dev"

func main() {
	commands.Execute(version, os.Args)
}
