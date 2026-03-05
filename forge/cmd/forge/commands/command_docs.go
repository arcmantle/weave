package commands

import (
	"fmt"
	"os"
	"os/exec"

	"github.com/arcmantle/forge/cmd/forge/commands/detach"
	"github.com/arcmantle/forge/internal/docs"
)

func runDocs() {
	exePath, err := os.Executable()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	cmd := exec.Command(exePath, "--docs-serve")
	cmd.Dir, _ = os.Getwd()
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	detach.DetachProcess(cmd)

	if err := cmd.Start(); err != nil {
		fmt.Fprintf(os.Stderr, "error starting docs server: %v\n", err)
		os.Exit(1)
	}
}

func runDocsServe() {
	m := getFullManifest()
	if err := docs.Serve(m, forgeVersion); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}
