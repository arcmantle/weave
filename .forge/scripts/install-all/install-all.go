package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/arcmantle/forge/helpers"
)

func main() {
	root, err := os.Getwd()
	if err != nil {
		helpers.Error("failed to get working directory: %v", err)
		os.Exit(1)
	}

	dirs, err := helpers.FindDirsContaining(root, "pnpm-workspace.yaml")
	if err != nil {
		helpers.Error("failed to scan for workspaces: %v", err)
		os.Exit(1)
	}

	if len(dirs) == 0 {
		helpers.Warn("No workspaces found.")
		return
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
		helpers.Error("%d workspace(s) failed", failed)
		os.Exit(1)
	}

	helpers.Success("All workspaces installed.")
}
