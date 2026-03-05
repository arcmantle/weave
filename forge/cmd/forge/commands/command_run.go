package commands

import (
	"fmt"
	"os"
	"strings"

	"github.com/arcmantle/forge/internal/runner"
)

func runCommand(tokens []string) {
	m := getManifest()

	name, args := resolveCommand(tokens, m.Commands)

	cmd, ok := m.Commands[name]
	if !ok {
		children := commandsWithPrefix(name, m.Commands)
		if len(children) > 0 {
			fmt.Fprintf(os.Stderr, "error: '%s' is a command group, not a runnable command\n", name)
			fmt.Fprintf(os.Stderr, "\nAvailable subcommands:\n")
			for _, child := range children {
				suffix := child[len(name)+1:]
				desc := m.Commands[child].Description
				if desc != "" {
					fmt.Fprintf(os.Stderr, "  \033[36m%s\033[0m  %s\n", suffix, desc)
				} else {
					fmt.Fprintf(os.Stderr, "  \033[36m%s\033[0m\n", suffix)
				}
			}
			os.Exit(1)
		}

		fmt.Fprintf(os.Stderr, "error: unknown command '%s'\n", name)
		fmt.Fprintf(os.Stderr, "\nDid you mean one of these?\n")

		for cmdName := range m.Commands {
			suffix := cmdName
			if idx := strings.LastIndex(cmdName, ":"); idx != -1 {
				suffix = cmdName[idx+1:]
			}
			if strings.Contains(cmdName, name) || strings.Contains(suffix, name) ||
				strings.HasPrefix(cmdName, name[:min(3, len(name))]) {
				fmt.Fprintf(os.Stderr, "  %s\n", cmdName)
			}
		}

		fmt.Fprintf(os.Stderr, "\nRun 'forge --list' to see all available commands.\n")
		os.Exit(1)
	}

	if err := runner.Run(cmd, m, args); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}
