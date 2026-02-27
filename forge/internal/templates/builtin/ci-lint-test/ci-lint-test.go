package main

import (
	"os"
	"strings"
	"sync"

	"github.com/arcmantle/forge/helpers"
)

func main() {
	helpers.Info("running __NAME__")

	lintParts := strings.Fields("__VAR_LINT_COMMAND__")
	testParts := strings.Fields("__VAR_TEST_COMMAND__")

	var wg sync.WaitGroup
	var lintErr, testErr error

	wg.Add(2)

	go func() {
		defer wg.Done()
		helpers.Info("running lint...")
		lintErr = helpers.Exec(lintParts[0], lintParts[1:], helpers.RunOpts{Tag: "lint", Color: helpers.ColorCyan})
	}()

	go func() {
		defer wg.Done()
		helpers.Info("running tests...")
		testErr = helpers.Exec(testParts[0], testParts[1:], helpers.RunOpts{Tag: "test", Color: helpers.ColorMagenta})
	}()

	wg.Wait()

	failed := false
	if lintErr != nil {
		helpers.Error("lint failed: %v", lintErr)
		failed = true
	}
	if testErr != nil {
		helpers.Error("tests failed: %v", testErr)
		failed = true
	}

	if failed {
		os.Exit(1)
	}

	helpers.Success("lint and tests passed")
}
