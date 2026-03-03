package main

import (
	"os"
	"os/exec"
	"path/filepath"

	"github.com/arcmantle/forge/helpers"
)

func main() {
	cmd := helpers.Command("build-forge", "Build forge.exe into forge-playground for local testing")
	cmd.Parse()

	playgroundDir, err := os.Getwd()
	if err != nil {
		helpers.Error("failed to get working directory: %v", err)
		os.Exit(1)
	}

	repoRoot := filepath.Clean(filepath.Join(playgroundDir, ".."))
	forgeDir := filepath.Join(repoRoot, "forge")
	docsDir := filepath.Join(forgeDir, "internal", "docs")
	outputPath := filepath.Join(playgroundDir, "forge.exe")

	helpers.Info("Building docs client...")

	docsBuildCmd := exec.Command("bun", "run", "build")
	docsBuildCmd.Dir = docsDir
	docsBuildCmd.Stdout = os.Stdout
	docsBuildCmd.Stderr = os.Stderr

	if err := docsBuildCmd.Run(); err != nil {
		helpers.Error("docs client build failed: %v", err)
		os.Exit(1)
	}

	helpers.Info("Building forge.exe...")

	buildCmd := exec.Command("go", "build", "-o", outputPath, "./cmd/forge")
	buildCmd.Dir = forgeDir
	buildCmd.Stdout = os.Stdout
	buildCmd.Stderr = os.Stderr

	if err := buildCmd.Run(); err != nil {
		helpers.Error("go build failed: %v", err)
		os.Exit(1)
	}

	helpers.Success("Built %s", outputPath)
}