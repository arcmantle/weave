package commands

import (
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/arcmantle/forge/internal/manifest"
)

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

func getFullManifest() *manifest.Manifest {
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

	downScriptManifests, err := manifest.DiscoverScriptsDown(cwd)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	if len(scriptManifests) == 0 && len(downScriptManifests) == 0 {
		fmt.Fprintf(os.Stderr, "error: no .forge/scripts/ found in current, parent, or child directories\n")
		fmt.Fprintf(os.Stderr, "  run 'forge init' to scaffold one\n")
		os.Exit(1)
	}

	all := append(downScriptManifests, scriptManifests...)
	return manifest.Merge(all)
}

func resolveCommand(tokens []string, commands map[string]manifest.Command) (string, []string) {
	for n := len(tokens); n > 0; n-- {
		candidate := strings.Join(tokens[:n], ":")
		if _, ok := commands[candidate]; ok {
			return candidate, tokens[n:]
		}
	}

	return tokens[0], tokens[1:]
}

func commandsWithPrefix(prefix string, commands map[string]manifest.Command) []string {
	var matches []string
	pfx := prefix + ":"
	for name := range commands {
		if strings.HasPrefix(name, pfx) {
			matches = append(matches, name)
		}
	}
	sort.Strings(matches)

	return matches
}
