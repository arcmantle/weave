package helpers

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

// Cmd is a builder for defining and parsing command arguments.
// It supports positional args, string options, and boolean flags.
//
// Usage:
//
//	cmd := helpers.Command("greet", "Greet someone")
//	name := cmd.Arg("name", "Name to greet")
//	shout := cmd.Flag("shout", "Uppercase the greeting")
//	cmd.Parse()
//	fmt.Println(name.Value)
type Cmd struct {
	name        string
	description string
	defs        []*argDef
}

type argDef struct {
	name        string
	description string
	argType     string // "string" or "bool"
	positional  bool
	required    bool
	defaultVal  string
	value       any // *StringValue or *BoolValue
}

// StringValue holds a parsed string argument or option value.
type StringValue struct {
	Value string
}

// BoolValue holds a parsed boolean flag value.
type BoolValue struct {
	Value bool
}

// Command creates a new command argument builder.
func Command(name, description string) *Cmd {
	return &Cmd{
		name:        name,
		description: description,
	}
}

// Arg defines a required positional argument.
// Positional arguments are parsed in the order they are defined.
func (c *Cmd) Arg(name, description string) *StringValue {
	v := &StringValue{}
	c.defs = append(c.defs, &argDef{
		name:        name,
		description: description,
		argType:     "string",
		positional:  true,
		required:    true,
		value:       v,
	})

	return v
}

// Option defines a named string option (--name value).
// An optional default value can be provided.
func (c *Cmd) Option(name, description string, defaultVal ...string) *StringValue {
	def := ""
	if len(defaultVal) > 0 {
		def = defaultVal[0]
	}

	v := &StringValue{Value: def}
	c.defs = append(c.defs, &argDef{
		name:        name,
		description: description,
		argType:     "string",
		defaultVal:  def,
		value:       v,
	})

	return v
}

// Flag defines a boolean flag (--name). Presence sets it to true.
func (c *Cmd) Flag(name, description string) *BoolValue {
	v := &BoolValue{}
	c.defs = append(c.defs, &argDef{
		name:        name,
		description: description,
		argType:     "bool",
		value:       v,
	})

	return v
}

// Parse processes command-line arguments.
// If --forge-meta is present, it prints JSON metadata and exits.
// If --help or -h is present, it prints a help screen and exits.
func (c *Cmd) Parse() {
	args := os.Args[1:]

	for _, a := range args {
		if a == "--forge-meta" {
			c.printMeta()
			os.Exit(0)
		}
	}

	for _, a := range args {
		if a == "--help" || a == "-h" {
			c.printHelp()
			os.Exit(0)
		}
	}

	positionals := c.positionalDefs()
	posIdx := 0

	for i := 0; i < len(args); i++ {
		arg := args[i]

		if strings.HasPrefix(arg, "--") {
			name := strings.TrimPrefix(arg, "--")
			def := c.findNamed(name)
			if def == nil {
				Error("unknown flag: --%s", name)
				c.printHelp()
				os.Exit(1)
			}

			if def.argType == "bool" {
				def.value.(*BoolValue).Value = true
			} else {
				if i+1 >= len(args) {
					Error("flag --%s requires a value", name)
					os.Exit(1)
				}
				i++
				def.value.(*StringValue).Value = args[i]
			}
		} else {
			if posIdx >= len(positionals) {
				Error("unexpected argument: %s", arg)
				c.printHelp()
				os.Exit(1)
			}
			positionals[posIdx].value.(*StringValue).Value = arg
			posIdx++
		}
	}

	// Validate required positional args.
	for _, p := range positionals {
		if p.required && p.value.(*StringValue).Value == "" {
			Error("missing required argument: <%s>", p.name)
			c.printHelp()
			os.Exit(1)
		}
	}
}

func (c *Cmd) positionalDefs() []*argDef {
	var out []*argDef
	for _, d := range c.defs {
		if d.positional {
			out = append(out, d)
		}
	}

	return out
}

func (c *Cmd) findNamed(name string) *argDef {
	for _, d := range c.defs {
		if !d.positional && d.name == name {
			return d
		}
	}

	return nil
}

func (c *Cmd) printHelp() {
	positionals := c.positionalDefs()
	var flags []*argDef
	for _, d := range c.defs {
		if !d.positional {
			flags = append(flags, d)
		}
	}

	// Usage line.
	usage := "forge " + c.name
	for _, p := range positionals {
		usage += " <" + p.name + ">"
	}
	if len(flags) > 0 {
		usage += " [flags]"
	}

	fmt.Printf("%s — %s\n\n", c.name, c.description)
	fmt.Printf("Usage:\n  %s\n", usage)

	if len(positionals) > 0 {
		fmt.Println("\nArgs:")
		maxLen := 0
		for _, p := range positionals {
			if len(p.name) > maxLen {
				maxLen = len(p.name)
			}
		}
		for _, p := range positionals {
			fmt.Printf("  %-*s    %s\n", maxLen, p.name, p.description)
		}
	}

	if len(flags) > 0 {
		fmt.Println("\nFlags:")
		maxLen := 0
		for _, f := range flags {
			name := "--" + f.name
			if f.argType == "string" {
				name += " <value>"
			}
			if len(name) > maxLen {
				maxLen = len(name)
			}
		}
		for _, f := range flags {
			name := "--" + f.name
			if f.argType == "string" {
				name += " <value>"
			}
			desc := f.description
			if f.defaultVal != "" {
				desc += fmt.Sprintf(" (default: %s)", f.defaultVal)
			}
			fmt.Printf("  %-*s    %s\n", maxLen, name, desc)
		}
	}
}

type commandMeta struct {
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Args        []argMeta `json:"args,omitempty"`
}

type argMeta struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Description string `json:"description"`
	Positional  bool   `json:"positional,omitempty"`
	Required    bool   `json:"required,omitempty"`
	Default     string `json:"default,omitempty"`
}

func (c *Cmd) printMeta() {
	meta := commandMeta{
		Name:        c.name,
		Description: c.description,
	}

	for _, d := range c.defs {
		meta.Args = append(meta.Args, argMeta{
			Name:        d.name,
			Type:        d.argType,
			Description: d.description,
			Positional:  d.positional,
			Required:    d.required,
			Default:     d.defaultVal,
		})
	}

	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	enc.Encode(meta)
}
