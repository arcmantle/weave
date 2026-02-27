using Forge.Helpers;

var cmd = Cmd.Create("__NAME__", "Version bump, changelog, git tag, and publish");
var version = cmd.Arg("version", "Semantic version to release (e.g. 1.2.3)");
var dryRun = cmd.Flag("dry-run", "Show what would happen without making changes");
var changelog = cmd.Option("changelog", "Changelog file path", "__VAR_CHANGELOG_FILE__");
cmd.Parse();

var tag = $"v{version.Value}";

if (dryRun.Value)
{
	Log.Info($"[dry-run] would release {tag}");
	Log.Info($"[dry-run] changelog: {changelog.Value}");
	return;
}

// Ensure working tree is clean.
Log.Info("checking git status...");
Exec.RunSimple("git", "diff --quiet HEAD");

// Update changelog.
Log.Info($"updating {changelog.Value}...");
// TODO: Implement changelog generation logic here.

// Create git tag.
Log.Info($"creating tag {tag}...");
Exec.RunSimple("git", $"tag -a {tag} -m \"Release {tag}\"");

// Push tag.
Log.Info($"pushing tag {tag}...");
Exec.Run("git", $"push origin {tag}");

Log.Success($"released {tag}");
