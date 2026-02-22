package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/arcmantle/forge/helpers"
)

var Script = helpers.ScriptFunc(func(args []string) error {
	root, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("failed to get working directory: %w", err)
	}

	dirs, err := helpers.FindDirsContaining(root, "pnpm-workspace.yaml")
	if err != nil {
		return fmt.Errorf("failed to scan for workspaces: %w", err)
	}

	if len(dirs) == 0 {
		helpers.Warn("No workspaces found.")
		return nil
	}

	// Find longest name for alignment.
	maxLen := 0
	for _, dir := range dirs {
		name := filepath.Base(dir)
		if len(name) > maxLen {
			maxLen = len(name)
		}
	}

	failed := 0

	for i, dir := range dirs {
		name := filepath.Base(dir)
		color := helpers.Colors[i%len(helpers.Colors)]
		tag := fmt.Sprintf("%-*s", maxLen, name)

		helpers.Info("Installing %s...", name)

		err := helpers.Exec("pnpm", []string{"i"}, helpers.RunOpts{
			Dir:   dir,
			Tag:   tag,
			Color: color,
		})

		if err != nil {
			helpers.Error("%s failed", name)
			failed++
		} else {
			helpers.Success("%s done", name)
		}

		fmt.Println()
	}

	if failed > 0 {
		return fmt.Errorf("%d workspace(s) failed", failed)
	}

	helpers.Success("All workspaces installed.")
	return nil
})
