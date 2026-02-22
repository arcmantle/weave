package manifest

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// Arg defines a command argument.
type Arg struct {
	Name        string `yaml:"name"`
	Description string `yaml:"description"`
	Required    bool   `yaml:"required"`
	Default     string `yaml:"default"`
}

// RunStep represents a single step in a composite command.
// It is either a sequential command name or a set of parallel commands.
type RunStep struct {
	Command  string   // A single command to run sequentially.
	Parallel []string // Commands to run in parallel.
}

// UnmarshalYAML handles both string and map forms:
//
//	run:
//	  - clean                        → RunStep{Command: "clean"}
//	  - parallel: [lint, test]       → RunStep{Parallel: ["lint", "test"]}
func (s *RunStep) UnmarshalYAML(value *yaml.Node) error {
	// Try string first.
	if value.Kind == yaml.ScalarNode {
		s.Command = value.Value
		return nil
	}

	// Try map with "parallel" key.
	if value.Kind == yaml.MappingNode {
		var m map[string][]string
		if err := value.Decode(&m); err != nil {
			return fmt.Errorf("invalid run step: %w", err)
		}

		if cmds, ok := m["parallel"]; ok {
			s.Parallel = cmds
			return nil
		}

		return fmt.Errorf("run step map must have a 'parallel' key")
	}

	return fmt.Errorf("run step must be a string or {parallel: [...]}")
}

// Command defines a single runnable command.
type Command struct {
	Description string    `yaml:"description"`
	Script      string    `yaml:"script"`
	Run         []RunStep `yaml:"run"`
	Args        []Arg     `yaml:"args"`
	// Resolved at load time — not from YAML.
	ManifestDir string `yaml:"-"`
}

// Manifest represents a forge.yaml file.
type Manifest struct {
	Commands map[string]Command `yaml:"commands"`
}

// Load reads and parses a forge.yaml file from the given path.
func Load(path string) (*Manifest, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading manifest %s: %w", path, err)
	}

	var m Manifest
	if err := yaml.Unmarshal(data, &m); err != nil {
		return nil, fmt.Errorf("parsing manifest %s: %w", path, err)
	}

	if m.Commands == nil {
		m.Commands = make(map[string]Command)
	}

	dir := filepath.Dir(path)
	for name, cmd := range m.Commands {
		cmd.ManifestDir = dir
		m.Commands[name] = cmd
	}

	return &m, nil
}

// Merge combines multiple manifests in order. Later entries override earlier ones.
// This means the closest manifest (from CWD) takes priority.
func Merge(manifests []*Manifest) *Manifest {
	merged := &Manifest{
		Commands: make(map[string]Command),
	}

	// Iterate in reverse so that the closest manifest (last in the slice) wins.
	for i := len(manifests) - 1; i >= 0; i-- {
		for name, cmd := range manifests[i].Commands {
			if _, exists := merged.Commands[name]; !exists {
				merged.Commands[name] = cmd
			}
		}
	}

	return merged
}
