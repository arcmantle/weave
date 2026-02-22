package main

import (
	"github.com/arcmantle/forge/helpers"
)

var Script = helpers.ScriptFunc(func(args []string) error {
	helpers.Success("World")
	return nil
})
