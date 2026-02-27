package main

import (
	"os"

	"github.com/arcmantle/forge/helpers"
)

func main() {
	cmd := helpers.Command("__NAME__", "Build and deploy via docker-compose")
	buildFlag := cmd.Flag("build", "Rebuild images before deploying")
	file := cmd.Option("file", "Docker compose file", "__VAR_COMPOSE_FILE__")
	project := cmd.Option("project", "Project name", "__VAR_PROJECT_NAME__")
	cmd.Parse()

	args := []string{"-f", file.Value, "-p", project.Value}

	if buildFlag.Value {
		helpers.Info("building images...")
		if err := helpers.Exec("docker", append(args, "compose", "build"), helpers.RunOpts{}); err != nil {
			helpers.Error("build failed: %v", err)
			os.Exit(1)
		}
	}

	helpers.Info("deploying...")
	if err := helpers.Exec("docker", append(args, "compose", "up", "-d"), helpers.RunOpts{}); err != nil {
		helpers.Error("deploy failed: %v", err)
		os.Exit(1)
	}

	helpers.Success("deployed successfully")
}
