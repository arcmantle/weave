package helpers

// Script is the interface that all forge scripts must implement.
// This provides a consistent contract across languages:
//
//	Go:     var Script = helpers.ScriptFunc(func(args []string) error { ... })
//	TS:     export const script: Script = { run(args) { ... } }
//	C#:     public class MyScript : IForgeScript { public int Run(string[] args) => 0; }
type Script interface {
	Run(args []string) error
}

// ScriptFunc is an adapter that allows using a plain function as a Script.
type ScriptFunc func(args []string) error

// Run calls the function.
func (f ScriptFunc) Run(args []string) error {
	return f(args)
}
