package templates

import (
	"embed"
	"fmt"
	"io/fs"
	"path"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

//go:embed builtin/*/template.yaml builtin/*/*.go builtin/*/*.ts builtin/*/*.cs
var builtinFS embed.FS

// builtinNames is the list of built-in template directory names.
var builtinNames = []string{
	"ci-lint-test",
	"db-migrate",
	"docker-compose-deploy",
	"monorepo-install",
	"release",
}

// ListBuiltin returns metadata for all built-in templates.
func ListBuiltin() []BuiltinInfo {
	var list []BuiltinInfo

	for _, name := range builtinNames {
		metaPath := path.Join("builtin", name, "template.yaml")
		data, err := builtinFS.ReadFile(metaPath)
		if err != nil {
			continue
		}

		var meta TemplateMeta
		if err := yaml.Unmarshal(data, &meta); err != nil {
			continue
		}

		// Discover available languages.
		var langs []string
		for _, ext := range []string{".go", ".ts", ".cs"} {
			scriptPath := path.Join("builtin", name, name+ext)
			if _, err := builtinFS.ReadFile(scriptPath); err == nil {
				langs = append(langs, extToLang(ext))
			}
		}

		list = append(list, BuiltinInfo{
			Name:        name,
			Description: meta.Description,
			Languages:   langs,
			Variables:    meta.Variables,
		})
	}

	sort.Slice(list, func(i, j int) bool {
		return list[i].Name < list[j].Name
	})

	return list
}

// LoadBuiltin loads a built-in template by name.
func LoadBuiltin(name string) (*Template, error) {
	metaPath := path.Join("builtin", name, "template.yaml")
	data, err := builtinFS.ReadFile(metaPath)
	if err != nil {
		return nil, fmt.Errorf("unknown built-in template '%s'", name)
	}

	var meta TemplateMeta
	if err := yaml.Unmarshal(data, &meta); err != nil {
		return nil, fmt.Errorf("parsing template metadata: %w", err)
	}

	t := &Template{
		Name:    name,
		Meta:    meta,
		Scripts: make(map[string]string),
	}

	for _, ext := range []string{".go", ".ts", ".cs"} {
		scriptPath := path.Join("builtin", name, name+ext)
		content, err := builtinFS.ReadFile(scriptPath)
		if err != nil {
			continue
		}
		t.Scripts[ext] = string(content)
	}

	if len(t.Scripts) == 0 {
		return nil, fmt.Errorf("built-in template '%s' has no script files", name)
	}

	return t, nil
}

// IsBuiltin returns true if name matches a built-in template.
func IsBuiltin(name string) bool {
	for _, n := range builtinNames {
		if n == name {
			return true
		}
	}

	return false
}

// Resolve loads a template from a source string. It tries in order:
//  1. Built-in template name
//  2. Local directory path
//  3. Git URL (https:// prefix)
func Resolve(source string) (*Template, error) {
	return ResolveWithRegistries(source, nil)
}

// ResolveWithRegistries loads a template from a source string, also checking
// configured registries. It tries in order:
//  1. Built-in template name
//  2. Registry templates (from all configured registries)
//  3. Local directory path
//  4. Git URL (https:// prefix)
func ResolveWithRegistries(source string, registries []string) (*Template, error) {
	// Try built-in first.
	if IsBuiltin(source) {
		return LoadBuiltin(source)
	}

	// Try registries.
	if len(registries) > 0 {
		tpl, err := ResolveFromRegistries(source, registries)
		if err != nil {
			return nil, err
		}
		if tpl != nil {
			return tpl, nil
		}
	}

	// Try local directory.
	if isLocalDir(source) {
		return LoadFromDir(source)
	}

	// Try git URL.
	if strings.HasPrefix(source, "https://") || strings.HasPrefix(source, "http://") {
		return LoadFromGit(source)
	}

	// Unknown source — list available builtins for user.
	var names []string
	for _, n := range builtinNames {
		names = append(names, n)
	}

	msg := fmt.Sprintf("unknown template '%s'\n  available built-in templates: %s\n  for URLs, use https:// prefix", source, strings.Join(names, ", "))
	if len(registries) > 0 {
		msg += fmt.Sprintf("\n  searched %d registry(ies)", len(registries))
	}

	return nil, fmt.Errorf(msg)
}

func isLocalDir(path string) bool {
	info, err := fs.Stat(builtinFS, path)
	if err == nil && info.IsDir() {
		return false // it's from the embedded FS, not a local dir
	}

	// Check the real filesystem — delegate to os.Stat via the caller.
	// We can't import "os" in this check without circularity, but
	// LoadFromDir will handle the error if the path doesn't exist.
	return strings.Contains(path, "/") || strings.Contains(path, "\\") || strings.HasPrefix(path, ".")
}

// BuiltinInfo holds summary information about a built-in template.
type BuiltinInfo struct {
	Name        string
	Description string
	Languages   []string
	Variables   []TemplateVariable
}
