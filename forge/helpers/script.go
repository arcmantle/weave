package helpers

import "os"

// Args returns the command arguments passed to this script.
func Args() []string {
	return os.Args[1:]
}
