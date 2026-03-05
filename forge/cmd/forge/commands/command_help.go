package commands

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/arcmantle/forge/internal/runner"
)

func runHelp(args []string) {
	if len(args) == 0 {
		printUsage()
		return
	}

	if args[0] == "auth" {
		if len(args) >= 2 && args[1] == "github" {
			fmt.Println(authGitHubHelpText)
			return
		}

		fmt.Println(authHelpText)
		return
	}

	if args[0] == "templates" {
		fmt.Println(templatesHelpText)
		return
	}

	m := getManifest()
	name, _ := resolveCommand(args, m.Commands)

	cmd, ok := m.Commands[name]
	if !ok {
		children := commandsWithPrefix(name, m.Commands)
		if len(children) > 0 {
			fmt.Printf("%s — command group\n\n", name)
			fmt.Println("Subcommands:")
			for _, child := range children {
				suffix := child[len(name)+1:]
				desc := m.Commands[child].Description
				if desc != "" {
					fmt.Printf("  \033[36m%s\033[0m  %s\n", suffix, desc)
				} else {
					fmt.Printf("  \033[36m%s\033[0m\n", suffix)
				}
			}
			return
		}

		fmt.Fprintf(os.Stderr, "error: unknown command '%s'\n", name)
		os.Exit(1)
	}

	if len(cmd.Run) > 0 {
		fmt.Printf("%s — %s\n\n", name, cmd.Description)
		fmt.Println("Composite command:")
		for _, step := range cmd.Run {
			if len(step.Parallel) > 0 {
				fmt.Printf("  parallel: [%s]\n", strings.Join(step.Parallel, ", "))
			} else if len(step.Args) > 0 {
				fmt.Printf("  %s %s\n", step.Command, strings.Join(step.Args, " "))
			} else {
				fmt.Printf("  %s\n", step.Command)
			}
		}

		return
	}

	meta, err := runner.Meta(cmd, m)
	if err != nil || meta == nil {
		fmt.Printf("%s — %s\n", name, cmd.Description)
		if cmd.Script != "" {
			fmt.Printf("  script: %s\n", cmd.Script)
		}

		return
	}

	var parsed struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Args        []struct {
			Name        string `json:"name"`
			Type        string `json:"type"`
			Description string `json:"description"`
			Positional  bool   `json:"positional"`
			Required    bool   `json:"required"`
			Default     string `json:"default"`
		} `json:"args"`
	}

	if err := json.Unmarshal(meta, &parsed); err != nil {
		fmt.Printf("%s — %s\n", name, cmd.Description)
		return
	}

	var positionals, flags []struct {
		Name        string
		Type        string
		Description string
		Required    bool
		Default     string
	}

	for _, a := range parsed.Args {
		entry := struct {
			Name        string
			Type        string
			Description string
			Required    bool
			Default     string
		}{a.Name, a.Type, a.Description, a.Required, a.Default}

		if a.Positional {
			positionals = append(positionals, entry)
		} else {
			flags = append(flags, entry)
		}
	}

	usage := "forge " + name
	for _, p := range positionals {
		usage += " <" + p.Name + ">"
	}
	if len(flags) > 0 {
		usage += " [flags]"
	}

	desc := parsed.Description
	if desc == "" {
		desc = cmd.Description
	}

	fmt.Printf("%s — %s\n\n", name, desc)
	fmt.Printf("Usage:\n  %s\n", usage)

	if len(positionals) > 0 {
		fmt.Println("\nArgs:")
		maxLen := 0
		for _, p := range positionals {
			if len(p.Name) > maxLen {
				maxLen = len(p.Name)
			}
		}
		for _, p := range positionals {
			fmt.Printf("  %-*s    %s\n", maxLen, p.Name, p.Description)
		}
	}

	if len(flags) > 0 {
		fmt.Println("\nFlags:")
		maxLen := 0
		type flagEntry struct {
			display string
			desc    string
		}
		var entries []flagEntry
		for _, f := range flags {
			display := "--" + f.Name
			if f.Type == "string" {
				display += " <value>"
			}
			if len(display) > maxLen {
				maxLen = len(display)
			}
			desc := f.Description
			if f.Default != "" {
				desc += fmt.Sprintf(" (default: %s)", f.Default)
			}
			entries = append(entries, flagEntry{display, desc})
		}
		for _, e := range entries {
			fmt.Printf("  %-*s    %s\n", maxLen, e.display, e.desc)
		}
	}
}
