package main

import (
	"os"
	"path/filepath"

	"github.com/arcmantle/forge/helpers"
)

func main() {
	cmd := helpers.Command("clean", "Remove all node_modules directories recursively")
	dryrun := cmd.Flag("dryrun", "Show what would be removed without removing")
	cmd.Parse()

	root, err := os.Getwd()
	if err != nil {
		helpers.Error("failed to get working directory: %v", err)
		os.Exit(1)
	}

	if dryrun.Value {
		helpers.Info("Dry run — scanning for node_modules in %s...", root)
	} else {
		helpers.Info("Scanning for node_modules in %s...", root)
	}

	count := 0
	err = filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // skip inaccessible paths
		}

		if info.IsDir() && info.Name() == "node_modules" {
			rel, _ := filepath.Rel(root, path)

			if dryrun.Value {
				helpers.Info("Would remove %s", rel)
				count++
			} else {
				helpers.Info("Removing %s", rel)
				if err := os.RemoveAll(path); err != nil {
					helpers.Error("Failed to remove %s: %v", rel, err)
				} else {
					count++
				}
			}

			return filepath.SkipDir
		}

		return nil
	})

	if err != nil {
		helpers.Error("walk error: %v", err)
		os.Exit(1)
	}

	if count == 0 {
		helpers.Warn("No node_modules directories found.")
	} else if dryrun.Value {
		helpers.Success("Would remove %d node_modules director%s.", count, pluralize(count))
	} else {
		helpers.Success("Removed %d node_modules director%s.", count, pluralize(count))
	}
}

func pluralize(n int) string {
	if n == 1 {
		return "y"
	}
	return "ies"
}
