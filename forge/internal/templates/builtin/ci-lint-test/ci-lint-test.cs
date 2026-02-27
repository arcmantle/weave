using Forge.Helpers;

Log.Info("running __NAME__");

var lintParts = "__VAR_LINT_COMMAND__".Split(' ');
var testParts = "__VAR_TEST_COMMAND__".Split(' ');

var lintTask = Task.Run(() =>
{
	Log.Info("running lint...");
	Exec.Run(lintParts[0], string.Join(" ", lintParts.Skip(1)));
});

var testTask = Task.Run(() =>
{
	Log.Info("running tests...");
	Exec.Run(testParts[0], string.Join(" ", testParts.Skip(1)));
});

try
{
	Task.WaitAll(lintTask, testTask);
}
catch (AggregateException ex)
{
	foreach (var inner in ex.InnerExceptions)
	{
		Log.Error($"failed: {inner.Message}");
	}
	Environment.Exit(1);
}

Log.Success("lint and tests passed");
