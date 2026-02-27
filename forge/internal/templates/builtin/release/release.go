package main

import (
	"os"

	"github.com/arcmantle/forge/helpers"
)

func main() {
	cmd := helpers.Command("__NAME__", "Version bump, changelog, git tag, and publish")
	version := cmd.Arg("version", "Semantic version to release (e.g. 1.2.3)")
	dryRun := cmd.Flag("dry-run", "Show what would happen without making changes")
	changelog := cmd.Option("changelog", "Changelog file path", "__VAR_CHANGELOG_FILE__")
	cmd.Parse()

	tag := "v" + version.Value

	if dryRun.Value {
		helpers.Info("[dry-run] would release %s", tag)
		helpers.Info("[dry-run] changelog: %s", changelog.Value)
		return
	}

	// Ensure working tree is clean.
	helpers.Info("checking git status...")
	if _, err := helpers.ExecSimple("git", []string{"diff", "--quiet", "HEAD"}, ""); err != nil {
		helpers.Error("working tree is not clean — commit or stash changes first")
		os.Exit(1)
	}

	// Update changelog.
	helpers.Info("updating %s...", changelog.Value)
	// TODO: Implement changelog generation logic here.

	// Create git tag.
	helpers.Info("creating tag %s...", tag)
	if _, err := helpers.ExecSimple("git", []string{"tag", "-a", tag, "-m", "Release " + tag}, ""); err != nil {
		helpers.Error("failed to create tag: %v", err)
		os.Exit(1)
	}

	// Push tag.
	helpers.Info("pushing tag %s...", tag)
	if err := helpers.Exec("git", []string{"push", "origin", tag}, helpers.RunOpts{}); err != nil {
		helpers.Error("failed to push tag: %v", err)
		os.Exit(1)
	}

	helpers.Success("released %s", tag)
}
