package manifest

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

// RunStep represents a single step in a composite command.
// It is either a sequential command reference (with optional args),
// or a set of parallel command references.
type RunStep struct {
	Command  string   // A single command to run sequentially.
	Args     []string // Arguments to pass to this step's command.
	Parallel []string // Commands to run in parallel (may contain inline args).
}

// UnmarshalYAML handles multiple forms:
//
//	run:
//	  - clean                        → RunStep{Command: "clean"}
//	  - "clean --dryrun"             → RunStep{Command: "clean", Args: ["--dryrun"]}
//	  - parallel: [lint, test]       → RunStep{Parallel: ["lint", "test"]}
//	  - command: clean               → RunStep{Command: "clean", Args: ["--dryrun"]}
//	    args: [--dryrun]
func (s *RunStep) UnmarshalYAML(value *yaml.Node) error {
	// Try string first — supports optional inline args.
	if value.Kind == yaml.ScalarNode {
		parts := strings.Fields(value.Value)
		s.Command = parts[0]
		if len(parts) > 1 {
			s.Args = parts[1:]
		}

		return nil
	}

	// Try map — either {parallel: [...]} or {command: ..., args: [...]}.
	if value.Kind == yaml.MappingNode {
		for i := 0; i < len(value.Content); i += 2 {
			key := value.Content[i].Value
			val := value.Content[i+1]

			switch key {
			case "parallel":
				var cmds []string
				if err := val.Decode(&cmds); err != nil {
					return fmt.Errorf("invalid parallel block: %w", err)
				}
				s.Parallel = cmds

				return nil
			case "command":
				s.Command = val.Value
			case "args":
				if err := val.Decode(&s.Args); err != nil {
					return fmt.Errorf("invalid step args: %w", err)
				}
			}
		}

		if s.Command != "" {
			return nil
		}

		return fmt.Errorf("run step map must have a 'parallel' or 'command' key")
	}

	return fmt.Errorf("run step must be a string, {parallel: [...]}, or {command: ..., args: [...]}")
}

// Command defines a single runnable command.
type Command struct {
	Description string    `yaml:"description"`
	Script      string    `yaml:"script"`
	Run         []RunStep `yaml:"run"`
	// Resolved at load time — not from YAML.
	ManifestDir string `yaml:"-"`
}

// Manifest represents a forge.yaml file.
type Manifest struct {
	Commands   map[string]Command `yaml:"commands"`
	Registries []string           `yaml:"registries"`
	ManifestDir string            `yaml:"-"`
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
	m.ManifestDir = dir
	for name, cmd := range m.Commands {
		cmd.ManifestDir = dir
		m.Commands[name] = cmd
	}

	return &m, nil
}

// Merge combines multiple manifests in order. Later entries override earlier ones.
// This means the closest manifest (from CWD) takes priority.
// Registries are aggregated from all manifests with duplicates removed.
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

	// Aggregate registries from all manifests, preserving order and deduplicating.
	seen := map[string]bool{}
	for _, m := range manifests {
		for _, r := range m.Registries {
			resolved := strings.TrimSpace(r)
			if resolved == "" {
				continue
			}

			if !strings.HasPrefix(resolved, "https://") && !strings.HasPrefix(resolved, "http://") && !filepath.IsAbs(resolved) {
				base := strings.TrimSpace(m.ManifestDir)
				if base != "" {
					resolved = filepath.Clean(filepath.Join(base, resolved))
				}
			}

			if !seen[resolved] {
				seen[resolved] = true
				merged.Registries = append(merged.Registries, resolved)
			}
		}
	}

	return merged
}
