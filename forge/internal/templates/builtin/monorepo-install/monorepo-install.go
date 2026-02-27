package main

import (
	"os"
	"sync"

	"github.com/arcmantle/forge/helpers"
)

func main() {
	helpers.Info("running __NAME__")

	pm := "__VAR_PACKAGE_MANAGER__"

	dirs, err := helpers.FindDirsContaining(".", "package.json")
	if err != nil {
		helpers.Error("finding directories: %v", err)
		os.Exit(1)
	}

	if len(dirs) == 0 {
		helpers.Warn("no package.json files found")
		return
	}

	helpers.Info("installing dependencies in %d directories...", len(dirs))

	var wg sync.WaitGroup
	var mu sync.Mutex
	var failures []string

	for i, dir := range dirs {
		wg.Add(1)
		go func(dir string, color string) {
			defer wg.Done()
			err := helpers.Exec(pm, []string{"install"}, helpers.RunOpts{
				Dir:   dir,
				Tag:   dir,
				Color: color,
			})
			if err != nil {
				mu.Lock()
				failures = append(failures, dir)
				mu.Unlock()
			}
		}(dir, helpers.Colors[i%len(helpers.Colors)])
	}

	wg.Wait()

	if len(failures) > 0 {
		helpers.Error("%d install(s) failed: %v", len(failures), failures)
		os.Exit(1)
	}

	helpers.Success("all installs complete")
}
