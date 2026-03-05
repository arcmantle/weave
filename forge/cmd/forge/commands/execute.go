package commands

import (
	"fmt"
	"os"
)

var forgeVersion = "dev"

func Execute(version string, argv []string) {
	forgeVersion = version

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
