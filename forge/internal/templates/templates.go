package templates

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/arcmantle/forge/internal/manifest"
	"gopkg.in/yaml.v3"
)

// TemplateMeta defines the metadata for a script template.
type TemplateMeta struct {
	Description string             `yaml:"description"`
	Variables   []TemplateVariable `yaml:"variables"`
	Example     string             `yaml:"example,omitempty"`
	Run         []manifest.RunStep `yaml:"run,omitempty"`
	Commands    []TemplateCommand  `yaml:"commands,omitempty"`
}

// TemplateCommand defines an additional command template bundled with
// a parent template package.
//
// Example:
//
//	commands:
//	  - name: deploy:build
//	    path: commands/deploy/build
//	    script: build
type TemplateCommand struct {
	Name   string `yaml:"name"`
	Path   string `yaml:"path"`
	Script string `yaml:"script,omitempty"`
}

// TemplateVariable defines a placeholder variable in a template.
type TemplateVariable struct {
	Name        string `yaml:"name"`
	Description string `yaml:"description"`
	Default     string `yaml:"default"`
}

// Template represents a loaded template ready to be applied.
type Template struct {
	Name             string
	Meta             TemplateMeta
	Scripts          map[string]string   // ext -> content (e.g. ".go" -> "package main...")
	CommandTemplates map[string]*Template // command name -> command template
}

// Apply creates a script file from the template, replacing placeholder
// variables with the given values. Returns the script content for the
// specified language extension.
func (t *Template) Apply(name string, lang string, vars map[string]string) (string, error) {
	ext := langToExt(lang)
	content, ok := t.Scripts[ext]
	if !ok {
		if len(t.CommandTemplates) > 0 {
			return "", fmt.Errorf("template '%s' is a bundle template (%d command templates) and cannot be applied as a single script", t.Name, len(t.CommandTemplates))
		}

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
	name := filepath.Base(filepath.Clean(dir))

	return loadTemplateFromDirNamed(dir, name)
}

func loadTemplateFromDirNamed(dir string, templateName string) (*Template, error) {
	metaPath := filepath.Join(dir, "template.yaml")
	metaData, err := os.ReadFile(metaPath)
	if err != nil {
		return nil, fmt.Errorf("reading template.yaml: %w", err)
	}

	var meta TemplateMeta
	if err := yaml.Unmarshal(metaData, &meta); err != nil {
		return nil, fmt.Errorf("parsing template.yaml: %w", err)
	}

	scriptBaseName := strings.TrimSpace(templateName)
	if scriptBaseName == "" {
		scriptBaseName = filepath.Base(filepath.Clean(dir))
	}

	t := &Template{
		Name:             templateName,
		Meta:             meta,
		Scripts:          make(map[string]string),
		CommandTemplates: make(map[string]*Template),
	}

	// Look for script files named <script-base>.{go,ts,cs}.
	for _, ext := range []string{".go", ".ts", ".cs"} {
		scriptPath := filepath.Join(dir, scriptBaseName+ext)
		data, err := os.ReadFile(scriptPath)
		if err != nil {
			continue // Not every template supports every language.
		}
		t.Scripts[ext] = string(data)
	}

	for _, command := range t.Meta.Commands {
		commandName := strings.TrimSpace(command.Name)
		if commandName == "" {
			return nil, fmt.Errorf("template '%s' has a commands entry with empty name", templateName)
		}
		if _, exists := t.CommandTemplates[commandName]; exists {
			return nil, fmt.Errorf("template '%s' has duplicate commands entry '%s'", templateName, commandName)
		}

		commandPath := strings.TrimSpace(command.Path)
		if commandPath == "" {
			return nil, fmt.Errorf("template '%s' command '%s' is missing path", templateName, commandName)
		}
		if filepath.IsAbs(commandPath) {
			return nil, fmt.Errorf("template '%s' command '%s' path must be relative", templateName, commandName)
		}

		cleanCommandPath := filepath.Clean(commandPath)
		if cleanCommandPath == "." || cleanCommandPath == ".." || strings.HasPrefix(cleanCommandPath, ".."+string(filepath.Separator)) {
			return nil, fmt.Errorf("template '%s' command '%s' has invalid path '%s'", templateName, commandName, commandPath)
		}

		commandScript := strings.TrimSpace(command.Script)
		if commandScript == "" {
			commandScript = filepath.Base(cleanCommandPath)
		}
		if commandScript == "" || commandScript == "." || commandScript == ".." || strings.Contains(commandScript, "/") || strings.Contains(commandScript, "\\") {
			return nil, fmt.Errorf("template '%s' command '%s' has invalid script '%s'", templateName, commandName, commandScript)
		}

		commandDir := filepath.Join(dir, cleanCommandPath)
		child, err := loadTemplateFromDirNamed(commandDir, commandScript)
		if err != nil {
			return nil, fmt.Errorf("loading command template '%s' from '%s': %w", commandName, commandPath, err)
		}
		child.Name = commandName
		t.CommandTemplates[commandName] = child
	}

	if len(t.Scripts) == 0 && len(t.CommandTemplates) == 0 {
		return nil, fmt.Errorf("template '%s' has no script files and no command templates", scriptBaseName)
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
