package commands

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/arcmantle/forge/internal/manifest"
)

func listCommands() {
	m := getFullManifest()

	if len(m.Commands) == 0 {
		fmt.Println("No commands defined.")
		return
	}

	cwd, _ := os.Getwd()
	cwdClean := filepath.Clean(cwd)

	type sourceGroup struct {
		relPath  string
		commands map[string]manifest.Command
	}

	bySource := map[string]*sourceGroup{}
	var sourceOrder []string

	for name, cmd := range m.Commands {
		dir := filepath.Clean(cmd.ManifestDir)
		if _, ok := bySource[dir]; !ok {
			rel, err := filepath.Rel(cwdClean, dir)
			if err != nil {
				rel = dir
			}

			rel = filepath.ToSlash(rel)
			if rel == "." {
				rel = ""
			}

			bySource[dir] = &sourceGroup{
				relPath:  rel,
				commands: make(map[string]manifest.Command),
			}
			sourceOrder = append(sourceOrder, dir)
		}
		bySource[dir].commands[name] = cmd
	}

	sort.Slice(sourceOrder, func(i, j int) bool {
		a, b := bySource[sourceOrder[i]].relPath, bySource[sourceOrder[j]].relPath
		if a == "" {
			return true
		}
		if b == "" {
			return false
		}

		return a < b
	})

	hasMultipleSources := len(sourceOrder) > 1

	fmt.Println("Available commands:")

	for _, dir := range sourceOrder {
		sg := bySource[dir]

		if hasMultipleSources {
			if sg.relPath == "" {
				fmt.Printf("\n  \033[33m[local]\033[0m\n")
			} else {
				fmt.Printf("\n  \033[33m[%s]\033[0m\n", sg.relPath)
			}
		} else {
			fmt.Println()
		}

		printCommandGroup(sg.commands)
	}
}

func printCommandGroup(commands map[string]manifest.Command) {
	names := make([]string, 0, len(commands))
	for name := range commands {
		names = append(names, name)
	}
	sort.Strings(names)

	type group struct {
		children []string
	}
	groups := map[string]*group{}
	var topLevel []string

	for _, name := range names {
		if idx := strings.Index(name, ":"); idx != -1 {
			prefix := name[:idx]
			g, ok := groups[prefix]
			if !ok {
				g = &group{}
				groups[prefix] = g
			}
			g.children = append(g.children, name)
		} else {
			topLevel = append(topLevel, name)
		}
	}

	var displayOrder []string
	shown := map[string]bool{}
	for _, name := range topLevel {
		displayOrder = append(displayOrder, name)
		shown[name] = true
	}
	for prefix := range groups {
		if !shown[prefix] {
			displayOrder = append(displayOrder, prefix)
		}
	}
	sort.Strings(displayOrder)

	maxLen := 0
	for _, name := range displayOrder {
		if len(name) > maxLen {
			maxLen = len(name)
		}
		if g, ok := groups[name]; ok {
			for _, child := range g.children {
				suffix := child[strings.LastIndex(child, ":")+1:]
				padded := len(suffix) + 2
				if padded > maxLen {
					maxLen = padded
				}
			}
		}
	}

	for _, name := range displayOrder {
		if cmd, ok := commands[name]; ok {
			desc := cmd.Description
			if desc == "" {
				desc = "\033[90m(no description)\033[0m"
			}
			fmt.Printf("  \033[36m%-*s\033[0m  %s\n", maxLen, name, desc)
		} else {
			fmt.Printf("  \033[36m%s\033[0m\n", name)
		}

		if g, ok := groups[name]; ok {
			for _, child := range g.children {
				suffix := child[strings.LastIndex(child, ":")+1:]
				desc := commands[child].Description
				if desc == "" {
					desc = "\033[90m(no description)\033[0m"
				}
				fmt.Printf("    \033[36m%-*s\033[0m  %s\n", maxLen-2, suffix, desc)
			}
		}
	}
}
