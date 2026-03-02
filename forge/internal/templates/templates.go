package templates

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

// TemplateMeta defines the metadata for a script template.
type TemplateMeta struct {
	Description string             `yaml:"description"`
	Variables   []TemplateVariable `yaml:"variables"`
	Example     string             `yaml:"example,omitempty"`
}

// TemplateVariable defines a placeholder variable in a template.
type TemplateVariable struct {
	Name        string `yaml:"name"`
	Description string `yaml:"description"`
	Default     string `yaml:"default"`
}

// Template represents a loaded template ready to be applied.
type Template struct {
	Name    string
	Meta    TemplateMeta
	Scripts map[string]string // ext -> content (e.g. ".go" -> "package main...")
}

// Apply creates a script file from the template, replacing placeholder
// variables with the given values. Returns the script content for the
// specified language extension.
func (t *Template) Apply(name string, lang string, vars map[string]string) (string, error) {
	ext := langToExt(lang)
	content, ok := t.Scripts[ext]
	if !ok {
		available := t.AvailableLanguages()
		return "", fmt.Errorf("template '%s' has no %s script (available: %s)", t.Name, lang, strings.Join(available, ", "))
	}

	// Replace the command name placeholder.
	content = strings.ReplaceAll(content, "__NAME__", name)

	// Replace variable placeholders, using defaults when not provided.
	for _, v := range t.Meta.Variables {
		placeholder := "__VAR_" + strings.ToUpper(v.Name) + "__"
		value, ok := vars[v.Name]
		if !ok {
			value = v.Default
		}
		content = strings.ReplaceAll(content, placeholder, value)
	}

	return content, nil
}

// AvailableLanguages returns the language keys this template supports.
func (t *Template) AvailableLanguages() []string {
	var langs []string
	for ext := range t.Scripts {
		langs = append(langs, extToLang(ext))
	}

	return langs
}

// HasLanguage returns whether the template supports the given language.
func (t *Template) HasLanguage(lang string) bool {
	ext := langToExt(lang)
	_, ok := t.Scripts[ext]

	return ok
}

// LoadFromDir loads a template from a local directory. The directory must
// contain a template.yaml metadata file and at least one script file
// named <dirname>.{go,ts,cs}.
func LoadFromDir(dir string) (*Template, error) {
	metaPath := filepath.Join(dir, "template.yaml")
	metaData, err := os.ReadFile(metaPath)
	if err != nil {
		return nil, fmt.Errorf("reading template.yaml: %w", err)
	}

	var meta TemplateMeta
	if err := yaml.Unmarshal(metaData, &meta); err != nil {
		return nil, fmt.Errorf("parsing template.yaml: %w", err)
	}

	name := filepath.Base(dir)
	t := &Template{
		Name:    name,
		Meta:    meta,
		Scripts: make(map[string]string),
	}

	// Look for script files named <template-name>.{go,ts,cs}.
	for _, ext := range []string{".go", ".ts", ".cs"} {
		scriptPath := filepath.Join(dir, name+ext)
		data, err := os.ReadFile(scriptPath)
		if err != nil {
			continue // Not every template supports every language.
		}
		t.Scripts[ext] = string(data)
	}

	if len(t.Scripts) == 0 {
		return nil, fmt.Errorf("template '%s' has no script files (expected %s.{go,ts,cs})", name, name)
	}

	if strings.TrimSpace(t.Meta.Example) == "" {
		examplePath := filepath.Join(dir, "example.md")
		if data, err := os.ReadFile(examplePath); err == nil {
			t.Meta.Example = string(data)
		}
	}

	return t, nil
}

func langToExt(lang string) string {
	switch lang {
	case "go":
		return ".go"
	case "ts":
		return ".ts"
	case "cs":
		return ".cs"
	default:
		return "." + lang
	}
}

func extToLang(ext string) string {
	switch ext {
	case ".go":
		return "go"
	case ".ts":
		return "ts"
	case ".cs":
		return "cs"
	default:
		return strings.TrimPrefix(ext, ".")
	}
}
