package main

import "github.com/arcmantle/forge/helpers"

func main() {
    helpers.Info("Running CI for ci")
    helpers.Exec("sh", []string{"-c", "pnpm lint && pnpm test"}, helpers.RunOpts{})
}
