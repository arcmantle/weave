package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/arcmantle/forge/helpers"
)

var Script = helpers.ScriptFunc(func(args []string) error {
	dryrun := false
	for _, a := range args {
		if a == "--dryrun" {
			dryrun = true
		}
	}

	root, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("failed to get working directory: %w", err)
	}

	if dryrun {
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

			if dryrun {
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
		return fmt.Errorf("walk error: %w", err)
	}

	if count == 0 {
		helpers.Warn("No node_modules directories found.")
	} else if dryrun {
		helpers.Success("Would remove %d node_modules director%s.", count, pluralize(count))
	} else {
		helpers.Success("Removed %d node_modules director%s.", count, pluralize(count))
	}

	return nil
})

func pluralize(n int) string {
	if n == 1 {
		return "y"
	}
	return "ies"
}
