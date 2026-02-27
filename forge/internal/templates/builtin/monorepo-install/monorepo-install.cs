using Forge.Helpers;

Log.Info("running __NAME__");

var pm = "__VAR_PACKAGE_MANAGER__";

var dirs = Fs.FindDirsContaining(".", "package.json");
if (dirs.Length == 0)
{
	Log.Warn("no package.json files found");
	return;
}

Log.Info($"installing dependencies in {dirs.Length} directories...");

var tasks = dirs.Select(dir =>
	Exec.RunSimple(pm, "install", dir)
).ToArray();

Task.WaitAll(tasks);

Log.Success("all installs complete");
