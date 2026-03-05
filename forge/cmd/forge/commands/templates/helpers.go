package templates

import (
	"fmt"
	"os"

	"github.com/arcmantle/forge/internal/manifest"
)

const templatesUsageLine = "forge templates [publish <command> --version <version> [--registry <path-or-url>] [--template <name>] [--scope <branch>] [--description <text>] [--message <text>] [--dry-run] | init-repo --name <repo-name> [--owner <owner>] [--path <dir>] [--private|--public] [--description <text>] [--dry-run]]"

func getManifest() *manifest.Manifest {
	cwd, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: could not get working directory: %v\n", err)
		os.Exit(1)
	}

	scriptManifests, err := manifest.DiscoverScripts(cwd)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	if len(scriptManifests) == 0 {
		fmt.Fprintf(os.Stderr, "error: no .forge/scripts/ found in current or parent directories\n")
		fmt.Fprintf(os.Stderr, "  run 'forge init' to scaffold one\n")
		os.Exit(1)
	}

	return manifest.Merge(scriptManifests)
}

func collectRegistries() []string {
	cwd, err := os.Getwd()
	if err != nil {
		return nil
	}

	manifests, err := manifest.DiscoverScripts(cwd)
	if err != nil || len(manifests) == 0 {
		return nil
	}

	merged := manifest.Merge(manifests)
	return merged.Registries
}
