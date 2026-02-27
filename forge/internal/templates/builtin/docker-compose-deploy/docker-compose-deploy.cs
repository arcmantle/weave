using Forge.Helpers;

var cmd = Cmd.Create("__NAME__", "Build and deploy via docker-compose");
var buildFlag = cmd.Flag("build", "Rebuild images before deploying");
var file = cmd.Option("file", "Docker compose file", "__VAR_COMPOSE_FILE__");
var project = cmd.Option("project", "Project name", "__VAR_PROJECT_NAME__");
cmd.Parse();

var baseArgs = $"-f {file.Value} -p {project.Value}";

if (buildFlag.Value)
{
	Log.Info("building images...");
	Exec.Run("docker", $"{baseArgs} compose build");
}

Log.Info("deploying...");
Exec.Run("docker", $"{baseArgs} compose up -d");
Log.Success("deployed successfully");
