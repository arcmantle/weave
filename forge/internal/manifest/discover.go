package manifest

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

// scriptExtensions lists the file extensions that are recognized as forge scripts.
var scriptExtensions = []string{".go", ".ts", ".cs"}

// skipDirs are directory names to ignore during downward traversal.
var skipDirs = map[string]bool{
	"node_modules": true,
	".git":         true,
	".forge":       true,
	"bin":          true,
	"obj":          true,
	"dist":         true,
	"out":          true,
	"vendor":       true,
}

type commandTemplate struct {
	Description string    `yaml:"description"`
	Script      string    `yaml:"script"`
	Run         []RunStep `yaml:"run"`
}

type forgeConfig struct {
	Registries []string `yaml:"registries"`
}

// DiscoverScripts walks up from startDir to the filesystem root, collecting
// commands from .forge/scripts/**/template.yaml files.
//
// Returns manifests ordered from root (furthest ancestor) to startDir
// (closest).
func DiscoverScripts(startDir string) ([]*Manifest, error) {
	var manifests []*Manifest
	dir := startDir

	for {
		scriptsDir := filepath.Join(dir, ForgeDirName, ScriptsDirName)
		if info, err := os.Stat(scriptsDir); err == nil && info.IsDir() {
			m, discoverErr := discoverScriptsInDir(scriptsDir, dir)
			if discoverErr != nil {
				return nil, discoverErr
			}
			if m != nil && len(m.Commands) > 0 {
				manifests = append(manifests, m)
			}
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			break // reached filesystem root
		}
		dir = parent
	}

	if len(manifests) == 0 {
		return nil, nil
	}

	for i, j := 0, len(manifests)-1; i < j; i, j = i+1, j-1 {
		manifests[i], manifests[j] = manifests[j], manifests[i]
	}

	return manifests, nil
}

// DiscoverScriptsDown walks into subdirectories of startDir, collecting
// commands from .forge/scripts/**/template.yaml directories below
// (excluding startDir itself). Returns manifests ordered by path depth.
func DiscoverScriptsDown(startDir string) ([]*Manifest, error) {
	var manifests []*Manifest

	err := filepath.WalkDir(startDir, func(p string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}

		if !d.IsDir() {
			return nil
		}

		if skipDirs[d.Name()] {
			return filepath.SkipDir
		}

		if p == startDir {
			return nil
		}

		scriptsDir := filepath.Join(p, ForgeDirName, ScriptsDirName)
		info, statErr := os.Stat(scriptsDir)
		if statErr != nil || !info.IsDir() {
			return nil
		}

		m, discoverErr := discoverScriptsInDir(scriptsDir, p)
		if discoverErr != nil {
			return nil
		}

		if m != nil && len(m.Commands) > 0 {
			manifests = append(manifests, m)
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return manifests, nil
}

// discoverScriptsInDir scans a .forge/scripts/ directory recursively and creates
// commands from folder-local template.yaml files.
//
// Convention:
//   .forge/scripts/deploy/prod/template.yaml -> command name "deploy:prod"
func discoverScriptsInDir(scriptsDir string, manifestDir string) (*Manifest, error) {
	registries, err := loadRegistries(manifestDir)
	if err != nil {
		return nil, err
	}

	m := &Manifest{
		Commands:   make(map[string]Command),
		Registries: registries,
		ManifestDir: manifestDir,
	}

	commandDirsWithTemplate := map[string]bool{}

	walkErr := filepath.WalkDir(scriptsDir, func(p string, d os.DirEntry, err error) error {
		if err != nil {
			return nil // skip unreadable entries
		}

		if d.IsDir() {
			if skipDirs[d.Name()] {
				return filepath.SkipDir
			}

			return nil
		}

		if d.Name() != CommandTemplateFile {
			return nil
		}

		cmdDir := filepath.Dir(p)
		commandDirsWithTemplate[filepath.Clean(cmdDir)] = true
		relCmdDir, relErr := filepath.Rel(scriptsDir, cmdDir)
		if relErr != nil || relCmdDir == "." {
			return nil
		}

		commandName := commandNameFromRelativePath(relCmdDir)
		if commandName == "" {
			return nil
		}

		cmd, parseErr := parseCommandTemplate(p, cmdDir, manifestDir)
		if parseErr != nil {
			return parseErr
		}
		m.Commands[commandName] = cmd

		return nil
	})
	if walkErr != nil {
		return nil, walkErr
	}

	inferErr := filepath.WalkDir(scriptsDir, func(p string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}

		if !d.IsDir() {
			return nil
		}

		if skipDirs[d.Name()] {
			if p == scriptsDir {
				return nil
			}

			return filepath.SkipDir
		}

		if p == scriptsDir {
			return nil
		}

		cleanDir := filepath.Clean(p)
		if commandDirsWithTemplate[cleanDir] {
			return nil
		}

		relCmdDir, relErr := filepath.Rel(scriptsDir, p)
		if relErr != nil || relCmdDir == "." {
			return nil
		}

		commandName := commandNameFromRelativePath(relCmdDir)
		if commandName == "" {
			return nil
		}

		if _, exists := m.Commands[commandName]; exists {
			return nil
		}

		relScript, ok := inferScriptPathForCommandDir(p, manifestDir)
		if !ok {
			return nil
		}

		m.Commands[commandName] = Command{
			Description: "",
			Script:      relScript,
			ManifestDir: manifestDir,
		}

		return nil
	})
	if inferErr != nil {
		return nil, inferErr
	}

	return m, nil
}

func inferScriptPathForCommandDir(commandDir string, manifestDir string) (string, bool) {
	leaf := filepath.Base(commandDir)
	for _, ext := range scriptExtensions {
		candidate := filepath.Join(commandDir, leaf+ext)
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			relScript, relErr := filepath.Rel(manifestDir, filepath.Clean(candidate))
			if relErr != nil {
				return "", false
			}

			return filepath.ToSlash(relScript), true
		}
	}

	var discovered []string
	for _, ext := range scriptExtensions {
		pattern := filepath.Join(commandDir, "*"+ext)
		matches, err := filepath.Glob(pattern)
		if err != nil {
			continue
		}
		for _, match := range matches {
			if info, statErr := os.Stat(match); statErr == nil && !info.IsDir() {
				discovered = append(discovered, filepath.Clean(match))
			}
		}
	}

	if len(discovered) != 1 {
		return "", false
	}

	relScript, relErr := filepath.Rel(manifestDir, discovered[0])
	if relErr != nil {
		return "", false
	}

	return filepath.ToSlash(relScript), true
}

func parseCommandTemplate(templatePath string, commandDir string, manifestDir string) (Command, error) {
	data, err := os.ReadFile(templatePath)
	if err != nil {
		return Command{}, fmt.Errorf("reading command template %s: %w", templatePath, err)
	}

	var tmpl commandTemplate
	if err := yaml.Unmarshal(data, &tmpl); err != nil {
		return Command{}, fmt.Errorf("parsing command template %s: %w", templatePath, err)
	}

	resolvedScript := strings.TrimSpace(tmpl.Script)
	if resolvedScript == "" && len(tmpl.Run) == 0 {
		leaf := filepath.Base(commandDir)
		for _, ext := range scriptExtensions {
			candidate := filepath.Join(commandDir, leaf+ext)
			if _, err := os.Stat(candidate); err == nil {
				resolvedScript = leaf + ext
				break
			}
		}
	}

	command := Command{
		Description: tmpl.Description,
		Run:         tmpl.Run,
		ManifestDir: manifestDir,
	}

	if resolvedScript == "" {
		return command, nil
	}

	absScript := resolvedScript
	if !filepath.IsAbs(absScript) {
		absScript = filepath.Join(commandDir, resolvedScript)
	}
	absScript = filepath.Clean(absScript)

	relScript, relErr := filepath.Rel(manifestDir, absScript)
	if relErr != nil {
		return Command{}, fmt.Errorf("resolving script path for %s: %w", templatePath, relErr)
	}

	command.Script = filepath.ToSlash(relScript)

	return command, nil
}

func commandNameFromRelativePath(relativePath string) string {
	clean := filepath.Clean(relativePath)
	if clean == "." || clean == "" {
		return ""
	}

	parts := strings.Split(filepath.ToSlash(clean), "/")
	cleanParts := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" || trimmed == "." || trimmed == ".." {
			return ""
		}
		cleanParts = append(cleanParts, trimmed)
	}

	return strings.Join(cleanParts, ":")
}

func loadRegistries(manifestDir string) ([]string, error) {
	configPath := filepath.Join(manifestDir, ForgeDirName, ConfigFileName)
	if _, err := os.Stat(configPath); err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}

		return nil, err
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("reading config %s: %w", configPath, err)
	}

	var cfg forgeConfig
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parsing config %s: %w", configPath, err)
	}

	return cfg.Registries, nil
}
