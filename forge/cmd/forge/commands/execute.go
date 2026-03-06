package commands

import (
	"fmt"
	"os"
	"strings"
)

var forgeVersion = "dev"

func Execute(version string, argv []string) {
	forgeVersion = version

	if len(argv) < 2 {
		printUsage()
		os.Exit(0)
	}

	// Extract global --cwd flag before command dispatch.
	filtered := []string{argv[0]}
	for i := 1; i < len(argv); i++ {
		arg := argv[i]
		switch {
		case arg == "--cwd":
			if i+1 >= len(argv) {
				fmt.Fprintf(os.Stderr, "error: --cwd requires a directory path\n")
				os.Exit(1)
			}
			i++
			if err := os.Chdir(argv[i]); err != nil {
				fmt.Fprintf(os.Stderr, "error: could not change to directory '%s': %v\n", argv[i], err)
				os.Exit(1)
			}
		case strings.HasPrefix(arg, "--cwd="):
			dir := strings.TrimPrefix(arg, "--cwd=")
			if err := os.Chdir(dir); err != nil {
				fmt.Fprintf(os.Stderr, "error: could not change to directory '%s': %v\n", dir, err)
				os.Exit(1)
			}
		default:
			filtered = append(filtered, arg)
		}
	}
	argv = filtered

	if len(argv) < 2 {
		printUsage()
		os.Exit(0)
	}

	command := argv[1]
	args := argv[2:]

	switch command {
	case "--help", "-h":
		printUsage()
	case "--version", "-v":
		fmt.Printf("forge %s\n", forgeVersion)
	case "--list", "-l":
		listCommands()
	case "--docs":
		runDocs()
	case "--docs-serve":
		runDocsServe()
	case "init":
		runInit()
	case "add":
		runAdd(args)
	case "setup":
		runSetup(args)
	case "templates":
		runTemplates(args)
	case "auth":
		runAuth(args)
	case "help":
		runHelp(args)
	default:
		runCommand(argv[1:])
	}
}
