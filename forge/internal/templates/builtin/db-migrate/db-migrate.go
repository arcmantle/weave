package main

import (
	"os"

	"github.com/arcmantle/forge/helpers"
)

func main() {
	cmd := helpers.Command("__NAME__", "Run database migrations with rollback support")
	rollback := cmd.Flag("rollback", "Rollback the last migration instead of migrating")
	status := cmd.Flag("status", "Show migration status")
	dir := cmd.Option("dir", "Migrations directory", "__VAR_MIGRATIONS_DIR__")
	cmd.Parse()

	dbURL := os.Getenv("__VAR_DB_URL_ENV__")
	if dbURL == "" {
		helpers.Error("__VAR_DB_URL_ENV__ environment variable is not set")
		os.Exit(1)
	}

	if status.Value {
		helpers.Info("checking migration status in %s...", dir.Value)
		// TODO: Implement migration status check.
		return
	}

	if rollback.Value {
		helpers.Warn("rolling back last migration...")
		// TODO: Implement rollback logic.
		helpers.Success("rollback complete")
		return
	}

	helpers.Info("running migrations from %s...", dir.Value)
	// TODO: Implement migration logic. This is a starting point —
	// customize the migration runner to match your database tooling
	// (e.g. goose, migrate, prisma, dbmate, etc.)
	helpers.Success("migrations complete")
}
