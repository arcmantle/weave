package templates

import (
	"archive/zip"
	"bufio"
	"fmt"
	"io"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

// RegistryIndex represents a registry.yaml file that indexes templates
// in a registry directory. This allows listing templates without reading
// each template's metadata individually.
type RegistryIndex struct {
	Name      string              `yaml:"name"`
	Templates []RegistryIndexItem `yaml:"templates"`
}

// RegistryIndexItem describes a single template within a registry index.
type RegistryIndexItem struct {
	Name        string             `yaml:"name"`
	Description string             `yaml:"description"`
	Languages   []string           `yaml:"languages"`
	Variables   []TemplateVariable `yaml:"variables"`
	Example     string             `yaml:"example,omitempty"`
}

// Registry represents a loaded external template registry.
type Registry struct {
	Name      string // Human-readable name.
	Source    string // Original URL or path used to load this registry.
	Templates []TemplateInfo
}

// TemplateInfo holds summary information about a template from any source
// (built-in, registry, or ad-hoc). This is the unified type used for
// listing templates across all sources.
type TemplateInfo struct {
	Name        string
	Description string
	Languages   []string
	Variables   []TemplateVariable
	Example     string
	LatestTag   string   // Latest tag discovered for this package (if any).
	Versions    []string // Available historical versions (newest first).
	Source      string   // "built-in", registry name, or URL.
	Registry    string   // Registry source string (empty for built-in).
	SourceType  string   // "built-in", "github-git", "local-git", "folder-index", "folder-scan"
}

// LoadRegistryIndex reads the registry.yaml index from a source (local
// directory or git URL) and returns template metadata without loading
// individual templates. This is used for listing available templates.
func LoadRegistryIndex(source string) (*Registry, error) {
	// Try local directory first.
	if isLocalPath(source) {
		if isLocalGitRepo(source) {
			reg, err := loadLocalGitBranchRegistry(source)
			if err == nil {
				return reg, nil
			}
		}
		return loadRegistryIndexFromDir(source)
	}

	// Git URL — clone and read.
	if strings.HasPrefix(source, "https://") || strings.HasPrefix(source, "http://") {
		return loadRegistryIndexFromGit(source)
	}

	return nil, fmt.Errorf("unsupported registry source: %s", source)
}

// LoadRegistryTemplate loads a specific template from a registry source.
// It clones/reads the registry and loads the named template from within it.
func LoadRegistryTemplate(source string, name string) (*Template, error) {
	return LoadRegistryTemplateWithRef(source, name, "")
}

// LoadRegistryTemplateWithRef loads a specific template from a registry source,
// optionally pinned to a git ref (tag or branch).
func LoadRegistryTemplateWithRef(source string, name string, ref string) (*Template, error) {
	if isLocalPath(source) && isLocalGitRepo(source) {
		tpl, err := loadTemplateFromLocalGitRef(source, name, ref)
		if err == nil {
			return tpl, nil
		}
	}

	repoURL, subdir := parseGitURL(source)
	if isGitHubRepoURL(repoURL) && subdir == "" {
		tpl, err := loadTemplateFromGitRef(repoURL, name, ref)
		if err == nil {
			return tpl, nil
		}
	}

	dir, cleanup, err := resolveRegistryDirWithRef(source, ref)
	if err != nil {
		return nil, err
	}
	if cleanup != nil {
		defer cleanup()
	}

	templateDir := filepath.Join(dir, name)
	metaPath := filepath.Join(templateDir, "template.yaml")
	if _, err := os.Stat(metaPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("template '%s' not found in registry '%s'", name, source)
	}

	return LoadFromDir(templateDir)
}

// ListAllTemplates aggregates templates from built-in sources and all
// provided registry URLs. Returns a unified list of TemplateInfo.
func ListAllTemplates(registries []string) []TemplateInfo {
	var all []TemplateInfo

	// Built-in templates first.
	for _, b := range ListBuiltin() {
		all = append(all, TemplateInfo{
			Name:        b.Name,
			Description: b.Description,
			Languages:   b.Languages,
			Variables:   b.Variables,
			Source:      "built-in",
			SourceType:  "built-in",
		})
	}

	// Registry templates.
	for _, source := range registries {
		reg, err := LoadRegistryIndex(source)
		if err != nil {
			// Skip unreachable registries but note the error.
			fmt.Fprintf(os.Stderr, "warning: could not load registry '%s': %v\n", source, err)
			continue
		}

		all = append(all, reg.Templates...)
	}

	return all
}

// ResolveFromRegistries tries to find and load a template by name from the
// given registry sources. Returns nil if no registry contains the template.
func ResolveFromRegistries(selector string, registries []string) (*Template, error) {
	templateName, ref := parseTemplateSelector(selector)

	for _, source := range registries {
		reg, err := LoadRegistryIndex(source)
		if err != nil {
			continue
		}

		for _, t := range reg.Templates {
			if t.Name == templateName {
				return LoadRegistryTemplateWithRef(source, templateName, ref)
			}
		}
	}

	return nil, nil
}

func parseTemplateSelector(selector string) (string, string) {
	selector = strings.TrimSpace(selector)
	idx := strings.LastIndex(selector, "@")
	if idx <= 0 || idx == len(selector)-1 {
		return selector, ""
	}

	return selector[:idx], selector[idx+1:]
}

// isLocalPath returns true if the source looks like a filesystem path
// rather than a URL.
func isLocalPath(source string) bool {
	if strings.HasPrefix(source, "https://") || strings.HasPrefix(source, "http://") {
		return false
	}

	// Check if it exists on disk.
	info, err := os.Stat(source)
	return err == nil && info.IsDir()
}

func loadRegistryIndexFromDir(dir string) (*Registry, error) {
	indexPath := filepath.Join(dir, "registry.yaml")
	data, err := os.ReadFile(indexPath)
	if err != nil {
		// No registry.yaml — scan for template directories instead.
		return scanRegistryDir(dir, dir)
	}

	var idx RegistryIndex
	if err := yaml.Unmarshal(data, &idx); err != nil {
		return nil, fmt.Errorf("parsing registry.yaml in %s: %w", dir, err)
	}

	reg := &Registry{
		Name:   idx.Name,
		Source: dir,
	}

	for _, item := range idx.Templates {
		reg.Templates = append(reg.Templates, TemplateInfo{
			Name:        item.Name,
			Description: item.Description,
			Languages:   item.Languages,
			Variables:   item.Variables,
			Example:     item.Example,
			Source:      idx.Name,
			Registry:    dir,
			SourceType:  "folder-index",
		})
	}

	return reg, nil
}

func loadRegistryIndexFromGit(url string) (*Registry, error) {
	repoURL, subdir := parseGitURL(url)
	if isGitHubRepoURL(repoURL) && subdir == "" {
		reg, err := loadGitHubBranchRegistry(repoURL)
		if err == nil {
			reg.Source = url
			for i := range reg.Templates {
				reg.Templates[i].Registry = url
			}
			return reg, nil
		}
	}

	dir, cleanup, err := cloneRegistryRepo(url)
	if err != nil {
		return nil, err
	}
	if cleanup != nil {
		defer cleanup()
	}

	reg, err := loadRegistryIndexFromDir(dir)
	if err != nil {
		return nil, err
	}

	// Override source to show the URL, not the temp dir.
	reg.Source = url
	for i := range reg.Templates {
		reg.Templates[i].Registry = url
	}

	return reg, nil
}

func loadGitHubBranchRegistry(repoURL string) (*Registry, error) {
	provider := githubGitSourceInfoProvider{}
	return provider.LoadRegistry(repoURL)
}

func loadLocalGitBranchRegistry(repoDir string) (*Registry, error) {
	provider := localGitSourceInfoProvider{}
	return provider.LoadRegistry(repoDir)
}

func loadTemplateInfoFromLocalBranch(repoDir string, branch string, registryName string) (TemplateInfo, error) {
	metaData, metaErr := readLocalGitFileAtRef(repoDir, branch, "template.yaml")
	var meta TemplateMeta
	if metaErr == nil {
		if err := yaml.Unmarshal(metaData, &meta); err != nil {
			return TemplateInfo{}, fmt.Errorf("parsing template metadata in local branch %s: %w", branch, err)
		}
	}

	description := strings.TrimSpace(meta.Description)
	if description == "" {
		description = readLocalGitReadmeSummary(repoDir, branch)
	}
	if description == "" {
		description = fmt.Sprintf("Template from branch %s", branch)
	}

	example := strings.TrimSpace(meta.Example)
	if example == "" {
		example = readLocalGitTemplateExample(repoDir, branch)
	}

	rootEntries, err := listLocalGitRootEntries(repoDir, branch)
	if err != nil {
		rootEntries = nil
	}

	return TemplateInfo{
		Name:        branch,
		Description: description,
		Languages:   detectTemplateLanguagesFromEntries(rootEntries),
		Variables:   meta.Variables,
		Example:     example,
		Source:      registryName,
		Registry:    repoDir,
		SourceType:  "local-git",
	}, nil
}

func loadTemplateInfosFromGitHubBranch(repoURL string, branch string, registryName string) ([]TemplateInfo, error) {
	dir, cleanup, err := cloneRegistryRepoBranch(repoURL, branch)
	if err != nil {
		return nil, err
	}
	if cleanup != nil {
		defer cleanup()
	}

	return loadTemplateInfosFromBranchDir(dir, branch, registryName, repoURL)
}

func loadTemplateInfoFromBranch(repoURL string, branch string, registryName string) (TemplateInfo, error) {
	templates, err := loadTemplateInfosFromGitHubBranch(repoURL, branch, registryName)
	if err != nil {
		return TemplateInfo{}, err
	}
	if len(templates) == 0 {
		return TemplateInfo{}, fmt.Errorf("template not found in branch %s", branch)
	}

	return templates[0], nil
}

func loadTemplateInfosFromBranchDir(dir string, branch string, registryName string, registrySource string) ([]TemplateInfo, error) {
	rootMetaPath := filepath.Join(dir, "template.yaml")
	if _, err := os.Stat(rootMetaPath); err == nil {
		tpl, buildErr := buildTemplateInfoFromDir(
			dir,
			branch,
			fmt.Sprintf("Template from branch %s", branch),
			registryName,
			registrySource,
			"github-git",
		)
		if buildErr != nil {
			return nil, buildErr
		}

		return []TemplateInfo{tpl}, nil
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("reading branch %s: %w", branch, err)
	}

	var templates []TemplateInfo
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		templateDir := filepath.Join(dir, entry.Name())
		metaPath := filepath.Join(templateDir, "template.yaml")
		if _, err := os.Stat(metaPath); err != nil {
			continue
		}

		templateName := branch + "/" + entry.Name()
		tpl, buildErr := buildTemplateInfoFromDir(
			templateDir,
			templateName,
			fmt.Sprintf("Template %s from branch %s", entry.Name(), branch),
			registryName,
			registrySource,
			"github-git",
		)
		if buildErr != nil {
			continue
		}

		templates = append(templates, tpl)
	}

	if len(templates) == 0 {
		return nil, fmt.Errorf("no templates discovered in branch %s", branch)
	}

	return templates, nil
}

func buildTemplateInfoFromDir(templateDir string, name string, fallbackDescription string, sourceName string, registrySource string, sourceType string) (TemplateInfo, error) {
	metaPath := filepath.Join(templateDir, "template.yaml")
	var meta TemplateMeta
	if data, err := os.ReadFile(metaPath); err == nil {
		if err := yaml.Unmarshal(data, &meta); err != nil {
			return TemplateInfo{}, fmt.Errorf("parsing template metadata in %s: %w", templateDir, err)
		}
	}

	description := strings.TrimSpace(meta.Description)
	if description == "" {
		description = readReadmeSummary(templateDir)
	}
	if description == "" {
		description = fallbackDescription
	}

	example := strings.TrimSpace(meta.Example)
	if example == "" {
		example = readTemplateExample(templateDir)
	}

	return TemplateInfo{
		Name:        name,
		Description: description,
		Languages:   detectTemplateLanguages(templateDir),
		Variables:   meta.Variables,
		Example:     example,
		Source:      sourceName,
		Registry:    registrySource,
		SourceType:  sourceType,
	}, nil
}

func detectTemplateLanguages(templateDir string) []string {
	entries, err := os.ReadDir(templateDir)
	if err != nil {
		return nil
	}

	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		names = append(names, entry.Name())
	}

	return detectTemplateLanguagesFromEntries(names)
}

func detectTemplateLanguagesFromEntries(entries []string) []string {
	seen := map[string]bool{}
	var langs []string
	for _, name := range entries {
		ext := strings.ToLower(filepath.Ext(name))
		switch ext {
		case ".go", ".ts", ".cs":
			lang := extToLang(ext)
			if !seen[lang] {
				seen[lang] = true
				langs = append(langs, lang)
			}
		}
	}

	return langs
}

func readReadmeSummary(dir string) string {
	for _, candidate := range []string{"README.md", "Readme.md", "readme.md"} {
		p := filepath.Join(dir, candidate)
		data, err := os.ReadFile(p)
		if err != nil {
			continue
		}

		summary := extractReadmeSummary(data)
		if summary != "" {
			return summary
		}
	}

	return ""
}

func readTemplateExample(dir string) string {
	data, err := os.ReadFile(filepath.Join(dir, "example.md"))
	if err != nil {
		return ""
	}

	return string(data)
}

func readLocalGitReadmeSummary(repoDir string, ref string) string {
	for _, candidate := range []string{"README.md", "Readme.md", "readme.md"} {
		data, err := readLocalGitFileAtRef(repoDir, ref, candidate)
		if err != nil {
			continue
		}

		summary := extractReadmeSummary(data)
		if summary != "" {
			return summary
		}
	}

	return ""
}

func readLocalGitTemplateExample(repoDir string, ref string) string {
	data, err := readLocalGitFileAtRef(repoDir, ref, "example.md")
	if err != nil {
		return ""
	}

	return string(data)
}

func extractReadmeSummary(data []byte) string {
	scanner := bufio.NewScanner(strings.NewReader(string(data)))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		if strings.HasPrefix(line, "#") {
			line = strings.TrimSpace(strings.TrimLeft(line, "#"))
			if line != "" {
				return line
			}
			continue
		}
		if strings.HasPrefix(line, "[") || strings.HasPrefix(line, "!") {
			continue
		}
		return line
	}

	return ""
}

func readLocalGitFileAtRef(repoDir string, ref string, filePath string) ([]byte, error) {
	relPath := filepath.ToSlash(strings.TrimSpace(filePath))
	if relPath == "" {
		return nil, fmt.Errorf("empty file path")
	}

	spec := fmt.Sprintf("%s:%s", ref, relPath)
	cmd := exec.Command("git", "-C", repoDir, "show", spec)
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("reading %s at ref %s in %s: %w", relPath, ref, repoDir, err)
	}

	return output, nil
}

func listLocalGitRootEntries(repoDir string, ref string) ([]string, error) {
	cmd := exec.Command("git", "-C", repoDir, "ls-tree", "--name-only", ref)
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("listing root entries at ref %s in %s: %w", ref, repoDir, err)
	}

	var entries []string
	seen := map[string]bool{}
	for _, line := range strings.Split(string(output), "\n") {
		name := strings.TrimSpace(line)
		if name == "" || seen[name] {
			continue
		}
		seen[name] = true
		entries = append(entries, name)
	}

	return entries, nil
}

func loadTemplateInfosFromLocalBranchesBatch(repoDir string, branches []string, registryName string) ([]TemplateInfo, error) {
	if len(branches) == 0 {
		return nil, nil
	}

	type branchPaths struct {
		metaSpec    string
		readmeSpec  []string
		exampleSpec string
		scriptSpec  map[string]string
	}

	pathsByBranch := make(map[string]branchPaths, len(branches))
	var contentSpecs []string
	var scriptSpecs []string

	for _, branch := range branches {
		metaSpec := fmt.Sprintf("%s:template.yaml", branch)
		readmeSpecs := []string{
			fmt.Sprintf("%s:README.md", branch),
			fmt.Sprintf("%s:Readme.md", branch),
			fmt.Sprintf("%s:readme.md", branch),
		}
		exampleSpec := fmt.Sprintf("%s:example.md", branch)
		scriptByLang := map[string]string{
			"go": fmt.Sprintf("%s:%s.go", branch, branch),
			"ts": fmt.Sprintf("%s:%s.ts", branch, branch),
			"cs": fmt.Sprintf("%s:%s.cs", branch, branch),
		}

		pathsByBranch[branch] = branchPaths{
			metaSpec:    metaSpec,
			readmeSpec:  readmeSpecs,
			exampleSpec: exampleSpec,
			scriptSpec:  scriptByLang,
		}

		contentSpecs = append(contentSpecs, metaSpec)
		contentSpecs = append(contentSpecs, readmeSpecs...)
		contentSpecs = append(contentSpecs, exampleSpec)
		scriptSpecs = append(scriptSpecs, scriptByLang["go"], scriptByLang["ts"], scriptByLang["cs"])
	}

	contentBySpec, err := readLocalGitSpecsBatch(repoDir, contentSpecs)
	if err != nil {
		return nil, err
	}

	existsBySpec, err := checkLocalGitSpecsExistBatch(repoDir, scriptSpecs)
	if err != nil {
		return nil, err
	}

	rootEntriesByBranch, rootEntriesErr := listLocalGitRootEntriesBatch(repoDir, branches)

	templates := make([]TemplateInfo, 0, len(branches))
	for _, branch := range branches {
		paths := pathsByBranch[branch]

		var meta TemplateMeta
		if metaData, ok := contentBySpec[paths.metaSpec]; ok {
			if err := yaml.Unmarshal(metaData, &meta); err != nil {
				return nil, fmt.Errorf("parsing template metadata in local branch %s: %w", branch, err)
			}
		}

		description := strings.TrimSpace(meta.Description)
		if description == "" {
			for _, spec := range paths.readmeSpec {
				data, ok := contentBySpec[spec]
				if !ok {
					continue
				}

				summary := extractReadmeSummary(data)
				if summary != "" {
					description = summary
					break
				}
			}
		}
		if description == "" {
			description = fmt.Sprintf("Template from branch %s", branch)
		}

		example := strings.TrimSpace(meta.Example)
		if example == "" {
			if data, ok := contentBySpec[paths.exampleSpec]; ok {
				example = string(data)
			}
		}

		var langs []string
		for _, lang := range []string{"go", "ts", "cs"} {
			spec := paths.scriptSpec[lang]
			if existsBySpec[spec] {
				langs = append(langs, lang)
			}
		}

		if len(langs) == 0 && rootEntriesErr == nil {
			langs = detectTemplateLanguagesFromEntries(rootEntriesByBranch[branch])
		}

		templates = append(templates, TemplateInfo{
			Name:        branch,
			Description: description,
			Languages:   langs,
			Variables:   meta.Variables,
			Example:     example,
			Source:      registryName,
			Registry:    repoDir,
			SourceType:  "local-git",
		})
	}

	return templates, nil
}

func listLocalGitRootEntriesBatch(repoDir string, branches []string) (map[string][]string, error) {
	if len(branches) == 0 {
		return map[string][]string{}, nil
	}

	treeSpecByBranch := make(map[string]string, len(branches))
	var treeSpecs []string
	for _, branch := range branches {
		treeSpec := fmt.Sprintf("%s^{tree}", branch)
		treeSpecByBranch[branch] = treeSpec
		treeSpecs = append(treeSpecs, treeSpec)
	}

	treeDataBySpec, err := readLocalGitSpecsBatch(repoDir, treeSpecs)
	if err != nil {
		return nil, err
	}

	result := make(map[string][]string, len(branches))
	for _, branch := range branches {
		treeSpec := treeSpecByBranch[branch]
		data, ok := treeDataBySpec[treeSpec]
		if !ok {
			continue
		}

		result[branch] = parseGitTreeRootBlobNames(data)
	}

	return result, nil
}

func parseGitTreeRootBlobNames(data []byte) []string {
	var names []string
	seen := map[string]bool{}

	for _, line := range strings.Split(strings.TrimSpace(string(data)), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		tabParts := strings.SplitN(line, "\t", 2)
		if len(tabParts) != 2 {
			continue
		}

		meta := strings.Fields(tabParts[0])
		if len(meta) < 2 {
			continue
		}
		if meta[1] != "blob" {
			continue
		}

		name := strings.TrimSpace(tabParts[1])
		if name == "" || seen[name] {
			continue
		}
		seen[name] = true
		names = append(names, name)
	}

	return names
}

func readLocalGitSpecsBatch(repoDir string, specs []string) (map[string][]byte, error) {
	if len(specs) == 0 {
		return map[string][]byte{}, nil
	}

	cmd := exec.Command("git", "-C", repoDir, "cat-file", "--batch")
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, fmt.Errorf("opening cat-file stdin for %s: %w", repoDir, err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("opening cat-file stdout for %s: %w", repoDir, err)
	}

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("starting cat-file for %s: %w", repoDir, err)
	}

	for _, spec := range specs {
		if _, err := io.WriteString(stdin, spec+"\n"); err != nil {
			_ = stdin.Close()
			_ = cmd.Wait()
			return nil, fmt.Errorf("writing spec %s for %s: %w", spec, repoDir, err)
		}
	}
	_ = stdin.Close()

	reader := bufio.NewReader(stdout)
	results := make(map[string][]byte)
	for _, spec := range specs {
		header, err := reader.ReadString('\n')
		if err != nil {
			_ = cmd.Wait()
			return nil, fmt.Errorf("reading cat-file header for %s in %s: %w", spec, repoDir, err)
		}

		header = strings.TrimSpace(header)
		if strings.HasSuffix(header, " missing") {
			continue
		}

		parts := strings.Fields(header)
		if len(parts) < 3 {
			_ = cmd.Wait()
			return nil, fmt.Errorf("unexpected cat-file header for %s in %s: %s", spec, repoDir, header)
		}

		var size int
		if _, err := fmt.Sscanf(parts[2], "%d", &size); err != nil {
			_ = cmd.Wait()
			return nil, fmt.Errorf("parsing cat-file size for %s in %s: %w", spec, repoDir, err)
		}

		if size < 0 {
			_ = cmd.Wait()
			return nil, fmt.Errorf("invalid cat-file size for %s in %s", spec, repoDir)
		}

		data := make([]byte, size)
		if _, err := io.ReadFull(reader, data); err != nil {
			_ = cmd.Wait()
			return nil, fmt.Errorf("reading cat-file body for %s in %s: %w", spec, repoDir, err)
		}

		if _, err := reader.ReadByte(); err != nil {
			_ = cmd.Wait()
			return nil, fmt.Errorf("reading cat-file separator for %s in %s: %w", spec, repoDir, err)
		}

		results[spec] = data
	}

	if err := cmd.Wait(); err != nil {
		return nil, fmt.Errorf("waiting for cat-file in %s: %w", repoDir, err)
	}

	return results, nil
}

func checkLocalGitSpecsExistBatch(repoDir string, specs []string) (map[string]bool, error) {
	if len(specs) == 0 {
		return map[string]bool{}, nil
	}

	cmd := exec.Command("git", "-C", repoDir, "cat-file", "--batch-check")
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, fmt.Errorf("opening cat-file --batch-check stdin for %s: %w", repoDir, err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("opening cat-file --batch-check stdout for %s: %w", repoDir, err)
	}

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("starting cat-file --batch-check for %s: %w", repoDir, err)
	}

	for _, spec := range specs {
		if _, err := io.WriteString(stdin, spec+"\n"); err != nil {
			_ = stdin.Close()
			_ = cmd.Wait()
			return nil, fmt.Errorf("writing batch-check spec %s for %s: %w", spec, repoDir, err)
		}
	}
	_ = stdin.Close()

	reader := bufio.NewReader(stdout)
	existsBySpec := make(map[string]bool, len(specs))
	for _, spec := range specs {
		line, err := reader.ReadString('\n')
		if err != nil {
			_ = cmd.Wait()
			return nil, fmt.Errorf("reading batch-check output for %s in %s: %w", spec, repoDir, err)
		}

		line = strings.TrimSpace(line)
		existsBySpec[spec] = !strings.HasSuffix(line, " missing")
	}

	if err := cmd.Wait(); err != nil {
		return nil, fmt.Errorf("waiting for cat-file --batch-check in %s: %w", repoDir, err)
	}

	return existsBySpec, nil
}

func listRemoteBranches(repoURL string) ([]string, error) {
	cmd := exec.Command("git", "ls-remote", "--heads", repoURL)
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("listing branches for %s: %w", repoURL, err)
	}

	var branches []string
	seen := map[string]bool{}
	for _, line := range strings.Split(string(output), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		parts := strings.Split(line, "\t")
		if len(parts) != 2 {
			continue
		}

		ref := strings.TrimSpace(parts[1])
		prefix := "refs/heads/"
		if !strings.HasPrefix(ref, prefix) {
			continue
		}

		branch := strings.TrimPrefix(ref, prefix)
		if branch == "" || seen[branch] {
			continue
		}
		seen[branch] = true
		branches = append(branches, branch)
	}

	sort.Strings(branches)
	return branches, nil
}

func listLocalBranches(repoDir string) ([]string, error) {
	cmd := exec.Command("git", "-C", repoDir, "for-each-ref", "--format=%(refname:short)", "refs/heads")
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("listing local branches for %s: %w", repoDir, err)
	}

	var branches []string
	seen := map[string]bool{}
	for _, line := range strings.Split(string(output), "\n") {
		branch := strings.TrimSpace(line)
		if branch == "" || seen[branch] {
			continue
		}
		seen[branch] = true
		branches = append(branches, branch)
	}

	sort.Strings(branches)
	return branches, nil
}

func listRemoteTags(repoURL string) ([]string, error) {
	cmd := exec.Command("git", "ls-remote", "--tags", "--refs", "--sort=-v:refname", repoURL)
	output, err := cmd.Output()
	if err != nil {
		fallback := exec.Command("git", "ls-remote", "--tags", "--refs", repoURL)
		output, err = fallback.Output()
		if err != nil {
			return nil, fmt.Errorf("listing tags for %s: %w", repoURL, err)
		}
	}

	var tags []string
	seen := map[string]bool{}
	for _, line := range strings.Split(string(output), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		parts := strings.Split(line, "\t")
		if len(parts) != 2 {
			continue
		}

		ref := strings.TrimSpace(parts[1])
		prefix := "refs/tags/"
		if !strings.HasPrefix(ref, prefix) {
			continue
		}

		tag := strings.TrimPrefix(ref, prefix)
		if tag == "" || seen[tag] {
			continue
		}
		seen[tag] = true
		tags = append(tags, tag)
	}

	return tags, nil
}

func listLocalTags(repoDir string) ([]string, error) {
	cmd := exec.Command("git", "-C", repoDir, "tag", "--list", "--sort=-v:refname")
	output, err := cmd.Output()
	if err != nil {
		fallback := exec.Command("git", "-C", repoDir, "tag", "--list")
		output, err = fallback.Output()
		if err != nil {
			return nil, fmt.Errorf("listing local tags for %s: %w", repoDir, err)
		}
	}

	var tags []string
	seen := map[string]bool{}
	for _, line := range strings.Split(string(output), "\n") {
		tag := strings.TrimSpace(line)
		if tag == "" || seen[tag] {
			continue
		}
		seen[tag] = true
		tags = append(tags, tag)
	}

	return tags, nil
}

func parsePackageTagRef(tag string) (string, string, bool) {
	trimmed := strings.TrimSpace(tag)
	idx := strings.LastIndex(trimmed, "/")
	if idx <= 0 || idx == len(trimmed)-1 {
		return "", "", false
	}

	pkg := strings.TrimSpace(trimmed[:idx])
	version := strings.TrimSpace(trimmed[idx+1:])
	if pkg == "" || version == "" {
		return "", "", false
	}

	return pkg, version, true
}

func cloneRegistryRepoBranch(repoURL string, branch string) (string, func(), error) {
	tmpDir, err := os.MkdirTemp("", "forge-registry-branch-*")
	if err != nil {
		return "", nil, fmt.Errorf("creating temp directory: %w", err)
	}

	cleanup := func() { os.RemoveAll(tmpDir) }

	cmd := exec.Command("git", "clone", "--quiet", "--depth", "1", "--single-branch", "--branch", branch, repoURL, tmpDir)
	if output, err := cmd.CombinedOutput(); err != nil {
		cleanup()
		return "", nil, fmt.Errorf("cloning %s (branch %s): %w: %s", repoURL, branch, err, strings.TrimSpace(string(output)))
	}

	return tmpDir, cleanup, nil
}

func cloneLocalRepoBranch(repoDir string, branch string) (string, func(), error) {
	tmpDir, err := os.MkdirTemp("", "forge-registry-local-branch-*")
	if err != nil {
		return "", nil, fmt.Errorf("creating temp directory: %w", err)
	}

	cleanup := func() { os.RemoveAll(tmpDir) }
	sourceURL := localRepoCloneURL(repoDir)

	cmd := exec.Command("git", "clone", "--quiet", "--depth", "1", "--single-branch", "--branch", branch, sourceURL, tmpDir)
	if output, err := cmd.CombinedOutput(); err != nil {
		cleanup()
		return "", nil, fmt.Errorf("cloning local repo %s (branch %s): %w: %s", repoDir, branch, err, strings.TrimSpace(string(output)))
	}

	return tmpDir, cleanup, nil
}

func cloneLocalRepoRef(repoDir string, ref string) (string, func(), error) {
	tmpDir, err := os.MkdirTemp("", "forge-registry-local-ref-*")
	if err != nil {
		return "", nil, fmt.Errorf("creating temp directory: %w", err)
	}

	cleanup := func() { os.RemoveAll(tmpDir) }
	sourceURL := localRepoCloneURL(repoDir)

	clone := exec.Command("git", "clone", "--quiet", "--depth", "1", "--no-single-branch", sourceURL, tmpDir)
	if output, err := clone.CombinedOutput(); err != nil {
		cleanup()
		return "", nil, fmt.Errorf("cloning local repo %s: %w: %s", repoDir, err, strings.TrimSpace(string(output)))
	}

	checkout := exec.Command("git", "-c", "advice.detachedHead=false", "checkout", "--quiet", ref)
	checkout.Dir = tmpDir
	if output, err := checkout.CombinedOutput(); err != nil {
		cleanup()
		return "", nil, fmt.Errorf("checking out ref %s in %s: %w: %s", ref, repoDir, err, strings.TrimSpace(string(output)))
	}

	return tmpDir, cleanup, nil
}

func cloneRegistryRepoRef(repoURL string, ref string) (string, func(), error) {
	tmpDir, err := os.MkdirTemp("", "forge-registry-ref-*")
	if err != nil {
		return "", nil, fmt.Errorf("creating temp directory: %w", err)
	}

	cleanup := func() { os.RemoveAll(tmpDir) }

	clone := exec.Command("git", "clone", "--quiet", "--depth", "1", "--no-single-branch", repoURL, tmpDir)
	if output, err := clone.CombinedOutput(); err != nil {
		cleanup()
		return "", nil, fmt.Errorf("cloning %s: %w: %s", repoURL, err, strings.TrimSpace(string(output)))
	}

	checkout := exec.Command("git", "-c", "advice.detachedHead=false", "checkout", "--quiet", ref)
	checkout.Dir = tmpDir
	if output, err := checkout.CombinedOutput(); err != nil {
		cleanup()
		return "", nil, fmt.Errorf("checking out ref %s in %s: %w: %s", ref, repoURL, err, strings.TrimSpace(string(output)))
	}

	return tmpDir, cleanup, nil
}

func loadTemplateFromGitBranch(repoURL string, branch string) (*Template, error) {
	return loadTemplateFromGitRef(repoURL, branch, "")
}

func loadTemplateFromLocalGitRef(repoDir string, branch string, ref string) (*Template, error) {
	if strings.TrimSpace(ref) == "" {
		dir, cleanup, err := exportLocalRepoRef(repoDir, branch)
		if err != nil {
			return nil, err
		}
		if cleanup != nil {
			defer cleanup()
		}

		if tpl, err := tryLoadTemplateFromRootOrSingleDirWithName(dir, branch); err == nil {
			return tpl, nil
		}

		return nil, fmt.Errorf("template '%s' not found in local branch registry '%s'", branch, repoDir)
	}

	dir, cleanup, err := cloneLocalRepoRefWithTemplateFallback(repoDir, branch, ref)
	if err != nil {
		return nil, err
	}
	if cleanup != nil {
		defer cleanup()
	}

	if tpl, err := tryLoadTemplateFromRootOrSingleDirWithName(dir, branch); err == nil {
		return tpl, nil
	}

	templateDir := filepath.Join(dir, branch)
	metaPath := filepath.Join(templateDir, "template.yaml")
	if _, err := os.Stat(metaPath); err == nil {
		return LoadFromDir(templateDir)
	}

	return nil, fmt.Errorf("template '%s' not found at ref '%s' in local repo '%s'", branch, ref, repoDir)
}

func cloneLocalRepoRefWithTemplateFallback(repoDir string, templateName string, ref string) (string, func(), error) {
	dir, cleanup, err := exportLocalRepoRef(repoDir, ref)
	if err == nil {
		return dir, cleanup, nil
	}

	if strings.Contains(ref, "/") {
		return "", nil, err
	}

	qualified := templateName + "/" + ref
	dir2, cleanup2, err2 := exportLocalRepoRef(repoDir, qualified)
	if err2 == nil {
		return dir2, cleanup2, nil
	}

	return "", nil, fmt.Errorf("%v; fallback %s failed: %v", err, qualified, err2)
}

func exportLocalRepoRef(repoDir string, ref string) (string, func(), error) {
	tmpDir, err := os.MkdirTemp("", "forge-registry-local-export-*")
	if err != nil {
		return "", nil, fmt.Errorf("creating temp directory: %w", err)
	}

	cleanup := func() { os.RemoveAll(tmpDir) }
	archivePath := filepath.Join(tmpDir, "repo.zip")

	archive := exec.Command("git", "-C", repoDir, "archive", "--format=zip", "-o", archivePath, ref)
	if output, err := archive.CombinedOutput(); err != nil {
		cleanup()
		return "", nil, fmt.Errorf("archiving local repo %s at ref %s: %w: %s", repoDir, ref, err, strings.TrimSpace(string(output)))
	}

	if err := extractZipToDir(archivePath, tmpDir); err != nil {
		cleanup()
		return "", nil, fmt.Errorf("extracting archive for local repo %s at ref %s: %w", repoDir, ref, err)
	}

	_ = os.Remove(archivePath)
	return tmpDir, cleanup, nil
}

func extractZipToDir(zipPath string, dstDir string) error {
	reader, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer reader.Close()

	base := filepath.Clean(dstDir) + string(filepath.Separator)
	for _, file := range reader.File {
		targetPath := filepath.Join(dstDir, file.Name)
		cleanTarget := filepath.Clean(targetPath)
		if !strings.HasPrefix(cleanTarget, base) && cleanTarget != filepath.Clean(dstDir) {
			return fmt.Errorf("zip entry escapes destination: %s", file.Name)
		}

		if file.FileInfo().IsDir() {
			if err := os.MkdirAll(cleanTarget, 0o755); err != nil {
				return err
			}
			continue
		}

		if err := os.MkdirAll(filepath.Dir(cleanTarget), 0o755); err != nil {
			return err
		}

		src, err := file.Open()
		if err != nil {
			return err
		}

		dst, err := os.Create(cleanTarget)
		if err != nil {
			src.Close()
			return err
		}

		_, copyErr := io.Copy(dst, src)
		closeDstErr := dst.Close()
		closeSrcErr := src.Close()
		if copyErr != nil {
			return copyErr
		}
		if closeDstErr != nil {
			return closeDstErr
		}
		if closeSrcErr != nil {
			return closeSrcErr
		}
	}

	return nil
}

func loadTemplateFromGitRef(repoURL string, branch string, ref string) (*Template, error) {
	selector := strings.TrimSpace(branch)
	branchName, subdir := splitScopedTemplateSelector(selector)
	if strings.TrimSpace(ref) == "" {
		return loadTemplateFromBranch(repoURL, selector)
	}

	dir, cleanup, err := cloneRegistryRepoRefWithTemplateFallback(repoURL, selector, ref)
	if err != nil {
		return nil, err
	}
	if cleanup != nil {
		defer cleanup()
	}

	if subdir != "" {
		templateDir := filepath.Join(dir, filepath.FromSlash(subdir))
		tpl, loadErr := loadTemplateFromDirWithName(templateDir, filepath.Base(subdir))
		if loadErr != nil {
			return nil, fmt.Errorf("template '%s' not found at ref '%s' in '%s'", selector, ref, repoURL)
		}
		tpl.Name = selector
		return tpl, nil
	}

	if tpl, err := tryLoadTemplateFromRootOrSingleDirWithName(dir, selector); err == nil {
		return tpl, nil
	}

	templateDir := filepath.Join(dir, branchName)
	metaPath := filepath.Join(templateDir, "template.yaml")
	if _, err := os.Stat(metaPath); err == nil {
		return LoadFromDir(templateDir)
	}

	return nil, fmt.Errorf("template '%s' not found at ref '%s' in '%s'", selector, ref, repoURL)
}

func cloneRegistryRepoRefWithTemplateFallback(repoURL string, templateName string, ref string) (string, func(), error) {
	dir, cleanup, err := cloneRegistryRepoRef(repoURL, ref)
	if err == nil {
		return dir, cleanup, nil
	}

	if strings.Contains(ref, "/") {
		return "", nil, err
	}

	qualified := templateName + "/" + ref
	dir2, cleanup2, err2 := cloneRegistryRepoRef(repoURL, qualified)
	if err2 == nil {
		return dir2, cleanup2, nil
	}

	return "", nil, fmt.Errorf("%v; fallback %s failed: %v", err, qualified, err2)
}

func loadTemplateFromBranch(repoURL string, branch string) (*Template, error) {
	selector := strings.TrimSpace(branch)
	branchName, subdir := splitScopedTemplateSelector(selector)

	dir, cleanup, err := cloneRegistryRepoBranch(repoURL, branchName)
	if err != nil {
		return nil, err
	}
	if cleanup != nil {
		defer cleanup()
	}

	if subdir != "" {
		templateDir := filepath.Join(dir, filepath.FromSlash(subdir))
		tpl, loadErr := loadTemplateFromDirWithName(templateDir, filepath.Base(subdir))
		if loadErr != nil {
			return nil, fmt.Errorf("template '%s' not found in branch registry '%s'", selector, repoURL)
		}
		tpl.Name = selector
		return tpl, nil
	}

	if tpl, err := tryLoadTemplateFromRootOrSingleDirWithName(dir, selector); err == nil {
		return tpl, nil
	}

	return nil, fmt.Errorf("template '%s' not found in branch registry '%s'", selector, repoURL)
}

func splitScopedTemplateSelector(selector string) (string, string) {
	trimmed := strings.TrimSpace(selector)
	idx := strings.Index(trimmed, "/")
	if idx <= 0 || idx == len(trimmed)-1 {
		return trimmed, ""
	}

	return trimmed[:idx], trimmed[idx+1:]
}

func tryLoadTemplateFromRootOrSingleDir(dir string) (*Template, error) {
	metaPath := filepath.Join(dir, "template.yaml")
	if _, err := os.Stat(metaPath); err == nil {
		return LoadFromDir(dir)
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("no template.yaml found in %s", dir)
	}

	found := ""
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		candidateDir := filepath.Join(dir, entry.Name())
		candidateMeta := filepath.Join(candidateDir, "template.yaml")
		if _, err := os.Stat(candidateMeta); err == nil {
			if found != "" {
				return nil, fmt.Errorf("multiple template directories found in %s", dir)
			}
			found = candidateDir
		}
	}

	if found != "" {
		return LoadFromDir(found)
	}

	return nil, fmt.Errorf("no template.yaml found in %s", dir)
}

func tryLoadTemplateFromRootOrSingleDirWithName(dir string, templateName string) (*Template, error) {
	metaPath := filepath.Join(dir, "template.yaml")
	if _, err := os.Stat(metaPath); err == nil {
		if tpl, err := loadTemplateFromDirWithName(dir, templateName); err == nil {
			return tpl, nil
		}
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("no template.yaml found in %s", dir)
	}

	found := ""
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		candidateDir := filepath.Join(dir, entry.Name())
		candidateMeta := filepath.Join(candidateDir, "template.yaml")
		if _, err := os.Stat(candidateMeta); err == nil {
			if found != "" {
				return nil, fmt.Errorf("multiple template directories found in %s", dir)
			}
			found = candidateDir
		}
	}

	if found != "" {
		return loadTemplateFromDirWithName(found, templateName)
	}

	return nil, fmt.Errorf("no template.yaml found in %s", dir)
}

func loadTemplateFromDirWithName(dir string, templateName string) (*Template, error) {
	return loadTemplateFromDirNamed(dir, templateName)
}

func resolveRegistryDirWithRef(source string, ref string) (string, func(), error) {
	if strings.TrimSpace(ref) == "" {
		return resolveRegistryDir(source)
	}

	if isLocalPath(source) {
		if isLocalGitRepo(source) {
			return cloneLocalRepoRef(source, ref)
		}
		return source, nil, nil
	}

	repoURL, subdir := parseGitURL(source)
	if strings.HasPrefix(repoURL, "https://") || strings.HasPrefix(repoURL, "http://") {
		dir, cleanup, err := cloneRegistryRepoRef(repoURL, ref)
		if err != nil {
			return "", nil, err
		}

		if subdir != "" {
			dir = filepath.Join(dir, filepath.FromSlash(subdir))
		}

		return dir, cleanup, nil
	}

	return "", nil, fmt.Errorf("unsupported registry source: %s", source)
}

func isGitHubRepoURL(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil {
		return false
	}

	host := strings.ToLower(u.Host)
	return host == "github.com" || strings.HasSuffix(host, ".github.com")
}

func isLocalGitRepo(path string) bool {
	if !isLocalPath(path) {
		return false
	}

	cmd := exec.Command("git", "-C", path, "rev-parse", "--is-inside-work-tree")
	output, err := cmd.Output()
	if err != nil {
		return false
	}

	return strings.TrimSpace(string(output)) == "true"
}

func registryDisplayName(repoURL string) string {
	u, err := url.Parse(repoURL)
	if err != nil {
		return "github"
	}

	parts := strings.Split(strings.Trim(strings.TrimSpace(u.Path), "/"), "/")
	if len(parts) == 0 {
		return "github"
	}

	name := parts[len(parts)-1]
	name = strings.TrimSuffix(name, ".git")
	if name == "" {
		return "github"
	}

	return name
}

// scanRegistryDir auto-discovers templates by scanning for subdirectories
// containing template.yaml files. Used when no registry.yaml index exists.
func scanRegistryDir(dir string, source string) (*Registry, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("reading registry directory: %w", err)
	}

	reg := &Registry{
		Name:   filepath.Base(dir),
		Source: source,
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		metaPath := filepath.Join(dir, entry.Name(), "template.yaml")
		data, err := os.ReadFile(metaPath)
		if err != nil {
			continue
		}

		var meta TemplateMeta
		if err := yaml.Unmarshal(data, &meta); err != nil {
			continue
		}

		example := strings.TrimSpace(meta.Example)
		if example == "" {
			example = readTemplateExample(filepath.Join(dir, entry.Name()))
		}

		// Discover available languages.
		var langs []string
		templateDir := filepath.Join(dir, entry.Name())
		for _, ext := range []string{".go", ".ts", ".cs"} {
			scriptPath := filepath.Join(templateDir, entry.Name()+ext)
			if _, err := os.Stat(scriptPath); err == nil {
				langs = append(langs, extToLang(ext))
			}
		}

		reg.Templates = append(reg.Templates, TemplateInfo{
			Name:        entry.Name(),
			Description: meta.Description,
			Languages:   langs,
			Variables:   meta.Variables,
			Example:     example,
			Source:      reg.Name,
			Registry:    source,
			SourceType:  "folder-scan",
		})
	}

	return reg, nil
}

// resolveRegistryDir returns the local filesystem path to a registry's
// template directory. For local paths it returns the path directly; for
// git URLs it clones to a temp dir and returns a cleanup function.
func resolveRegistryDir(source string) (string, func(), error) {
	if isLocalPath(source) {
		return source, nil, nil
	}

	if strings.HasPrefix(source, "https://") || strings.HasPrefix(source, "http://") {
		dir, cleanup, err := cloneRegistryRepo(source)
		return dir, cleanup, err
	}

	return "", nil, fmt.Errorf("unsupported registry source: %s", source)
}

// cloneRegistryRepo performs a shallow git clone and returns the temp
// directory path plus a cleanup function to remove it.
func cloneRegistryRepo(url string) (string, func(), error) {
	repoURL, subdir := parseGitURL(url)

	tmpDir, err := os.MkdirTemp("", "forge-registry-*")
	if err != nil {
		return "", nil, fmt.Errorf("creating temp directory: %w", err)
	}

	cleanup := func() { os.RemoveAll(tmpDir) }

	cmd := exec.Command("git", "clone", "--quiet", "--depth", "1", repoURL, tmpDir)
	if output, err := cmd.CombinedOutput(); err != nil {
		cleanup()
		return "", nil, fmt.Errorf("cloning %s: %w: %s", repoURL, err, strings.TrimSpace(string(output)))
	}

	dir := tmpDir
	if subdir != "" {
		dir = filepath.Join(tmpDir, filepath.FromSlash(subdir))
	}

	return dir, cleanup, nil
}

func localRepoCloneURL(repoDir string) string {
	abs, err := filepath.Abs(repoDir)
	if err != nil {
		abs = repoDir
	}

	path := filepath.ToSlash(abs)
	if strings.HasPrefix(path, "/") {
		return "file://" + path
	}

	return "file:///" + path
}
