package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/arcmantle/forge/internal/manifest"
	"github.com/arcmantle/forge/internal/templates"
	"gopkg.in/yaml.v3"
)

type templatePublishOptions struct {
	registry    string
	version     string
	template    string
	description string
	message     string
	dryRun      bool
	lang        string
}

func runTemplatesPublish(args []string) {
	if len(args) == 0 {
		fmt.Fprintf(os.Stderr, "error: publish requires a command name\n")
		fmt.Fprintf(os.Stderr, "  usage: %s\n", templatesUsageLine)
		os.Exit(1)
	}

	commandName := strings.TrimSpace(args[0])
	if commandName == "" {
		fmt.Fprintf(os.Stderr, "error: command name is required\n")
		os.Exit(1)
	}

	opts := templatePublishOptions{}
	for i := 1; i < len(args); i++ {
		arg := args[i]
		switch {
		case arg == "--registry":
			if i+1 >= len(args) {
				fmt.Fprintf(os.Stderr, "error: --registry requires a value\n")
				os.Exit(1)
			}
			i++
			opts.registry = strings.TrimSpace(args[i])
		case strings.HasPrefix(arg, "--registry="):
			opts.registry = strings.TrimSpace(strings.TrimPrefix(arg, "--registry="))
		case arg == "--version":
			if i+1 >= len(args) {
				fmt.Fprintf(os.Stderr, "error: --version requires a value\n")
				os.Exit(1)
			}
			i++
			opts.version = strings.TrimSpace(args[i])
		case strings.HasPrefix(arg, "--version="):
			opts.version = strings.TrimSpace(strings.TrimPrefix(arg, "--version="))
		case arg == "--template":
			if i+1 >= len(args) {
				fmt.Fprintf(os.Stderr, "error: --template requires a value\n")
				os.Exit(1)
			}
			i++
			opts.template = strings.TrimSpace(args[i])
		case strings.HasPrefix(arg, "--template="):
			opts.template = strings.TrimSpace(strings.TrimPrefix(arg, "--template="))
		case arg == "--description":
			if i+1 >= len(args) {
				fmt.Fprintf(os.Stderr, "error: --description requires a value\n")
				os.Exit(1)
			}
			i++
			opts.description = strings.TrimSpace(args[i])
		case strings.HasPrefix(arg, "--description="):
			opts.description = strings.TrimSpace(strings.TrimPrefix(arg, "--description="))
		case arg == "--message":
			if i+1 >= len(args) {
				fmt.Fprintf(os.Stderr, "error: --message requires a value\n")
				os.Exit(1)
			}
			i++
			opts.message = strings.TrimSpace(args[i])
		case strings.HasPrefix(arg, "--message="):
			opts.message = strings.TrimSpace(strings.TrimPrefix(arg, "--message="))
		case arg == "--lang":
			if i+1 >= len(args) {
				fmt.Fprintf(os.Stderr, "error: --lang requires a value\n")
				os.Exit(1)
			}
			i++
			opts.lang = strings.TrimSpace(strings.ToLower(args[i]))
		case strings.HasPrefix(arg, "--lang="):
			opts.lang = strings.TrimSpace(strings.ToLower(strings.TrimPrefix(arg, "--lang=")))
		case arg == "--dry-run":
			opts.dryRun = true
		default:
			fmt.Fprintf(os.Stderr, "error: unknown flag '%s'\n", arg)
			fmt.Fprintf(os.Stderr, "  usage: %s\n", templatesUsageLine)
			os.Exit(1)
		}
	}

	if opts.version == "" {
		fmt.Fprintf(os.Stderr, "error: --version is required\n")
		os.Exit(1)
	}

	m := getManifest()
	cmd, ok := m.Commands[commandName]
	if !ok {
		fmt.Fprintf(os.Stderr, "error: command '%s' not found in discovered manifests\n", commandName)
		os.Exit(1)
	}

	templateName := opts.template
	if templateName == "" {
		templateName = strings.ReplaceAll(commandName, ":", "-")
	}
	if templateName == "" || strings.Contains(templateName, " ") {
		fmt.Fprintf(os.Stderr, "error: invalid template name '%s'\n", templateName)
		os.Exit(1)
	}

	scriptPath := ""
	scriptData := []byte{}
	exampleData := []byte{}
	ext := ""

	if cmd.Script == "" {
		if len(cmd.Run) == 0 {
			fmt.Fprintf(os.Stderr, "error: command '%s' does not define a script\n", commandName)
			os.Exit(1)
		}

		generatedScript, generatedExt, genErr := generateCompositePublishScript(commandName, cmd, opts.lang)
		if genErr != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", genErr)
			os.Exit(1)
		}

		scriptPath = fmt.Sprintf("<generated composite script for %s>", commandName)
		scriptData = []byte(generatedScript)
		ext = generatedExt

		commandParts := strings.Split(commandName, ":")
		examplePath := filepath.Join(append([]string{cmd.ManifestDir, manifest.ForgeDirName, manifest.ScriptsDirName}, commandParts...)...)
		examplePath = filepath.Join(examplePath, "example.md")
		if data, err := os.ReadFile(examplePath); err == nil {
			exampleData = data
		}
	} else {
		scriptPath = cmd.Script
		if !filepath.IsAbs(scriptPath) {
			scriptPath = filepath.Join(cmd.ManifestDir, scriptPath)
		}
		scriptPath = filepath.Clean(scriptPath)

		data, readErr := os.ReadFile(scriptPath)
		if readErr != nil {
			fmt.Fprintf(os.Stderr, "error reading script %s: %v\n", scriptPath, readErr)
			os.Exit(1)
		}
		scriptData = data

		ext = strings.ToLower(filepath.Ext(scriptPath))
		switch ext {
		case ".go", ".ts", ".cs":
		default:
			fmt.Fprintf(os.Stderr, "error: script '%s' has unsupported extension '%s' (expected .go, .ts, or .cs)\n", scriptPath, ext)
			os.Exit(1)
		}

		if opts.lang != "" {
			fmt.Fprintf(os.Stderr, "warning: --lang is ignored for script-based commands\n")
		}

		examplePath := filepath.Join(filepath.Dir(scriptPath), "example.md")
		if data, err := os.ReadFile(examplePath); err == nil {
			exampleData = data
		}
	}

	description := opts.description
	if description == "" {
		description = cmd.Description
	}
	if description == "" {
		description = fmt.Sprintf("Template for command %s", commandName)
	}

	registrySource := opts.registry
	if registrySource == "" {
		registrySource = defaultPublishRegistry()
		if registrySource == "" {
			fmt.Fprintf(os.Stderr, "error: no local git registry found in manifest registries; pass --registry\n")
			os.Exit(1)
		}
	}

	cloneURL, displayRegistry := normalizeRegistrySource(registrySource)
	if cloneURL == "" {
		fmt.Fprintf(os.Stderr, "error: invalid registry source '%s'\n", registrySource)
		os.Exit(1)
	}

	baseVersion, err := normalizePublishVersion(templateName, opts.version)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	meta := templates.TemplateMeta{
		Description: description,
		Example:     string(exampleData),
	}
	metaBytes, err := yaml.Marshal(&meta)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error encoding template metadata: %v\n", err)
		os.Exit(1)
	}

	payloadHash := hashTemplatePayload(metaBytes, scriptData, exampleData)

	tagVersion, sameAsExistingTag, bumped, err := resolvePublishVersionByHash(cloneURL, templateName, baseVersion, ext, payloadHash)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error resolving publish version: %v\n", err)
		os.Exit(1)
	}
	tagRef := templateName + "/" + tagVersion

	if sameAsExistingTag {
		fmt.Printf("Template '\033[36m%s\033[0m' version '\033[33m%s\033[0m' already published (same hash).\n", templateName, tagVersion)
		fmt.Printf("  registry: %s\n", displayRegistry)
		fmt.Printf("  tag:      %s\n", tagRef)
		fmt.Printf("  hash:     %s\n", payloadHash)
		return
	}

	tmpDir, cleanup, err := cloneRegistryForPublish(cloneURL, templateName)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error preparing publish workspace: %v\n", err)
		os.Exit(1)
	}
	defer cleanup()

	if err := ensurePublishBranch(tmpDir, templateName); err != nil {
		fmt.Fprintf(os.Stderr, "error preparing branch '%s': %v\n", templateName, err)
		os.Exit(1)
	}

	if err := clearPublishWorkspace(tmpDir); err != nil {
		fmt.Fprintf(os.Stderr, "error clearing workspace: %v\n", err)
		os.Exit(1)
	}

	if err := os.WriteFile(filepath.Join(tmpDir, "template.yaml"), metaBytes, 0o644); err != nil {
		fmt.Fprintf(os.Stderr, "error writing template.yaml: %v\n", err)
		os.Exit(1)
	}

	templateScriptPath := filepath.Join(tmpDir, templateName+ext)
	if err := os.WriteFile(templateScriptPath, scriptData, 0o644); err != nil {
		fmt.Fprintf(os.Stderr, "error writing template script: %v\n", err)
		os.Exit(1)
	}

	if len(exampleData) > 0 {
		if err := os.WriteFile(filepath.Join(tmpDir, "example.md"), exampleData, 0o644); err != nil {
			fmt.Fprintf(os.Stderr, "error writing example.md: %v\n", err)
			os.Exit(1)
		}
	}

	if _, err := runGit(tmpDir, "add", "-A"); err != nil {
		fmt.Fprintf(os.Stderr, "error staging publish files: %v\n", err)
		os.Exit(1)
	}

	hasChanges, err := gitHasStagedChanges(tmpDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error checking staged changes: %v\n", err)
		os.Exit(1)
	}

	message := opts.message
	if message == "" {
		message = fmt.Sprintf("publish template %s@%s", templateName, tagVersion)
	}

	if opts.dryRun {
		fmt.Printf("Dry run for template publish '\033[36m%s\033[0m' version '\033[33m%s\033[0m'\n", templateName, tagVersion)
		fmt.Printf("  registry: %s\n", displayRegistry)
		if bumped {
			fmt.Printf("  requested version: %s\n", baseVersion)
		}
		fmt.Printf("  branch:   %s\n", templateName)
		fmt.Printf("  tag:      %s\n", tagRef)
		fmt.Printf("  source:   %s\n", scriptPath)
		fmt.Printf("  script:   %s\n", templateName+ext)
		fmt.Printf("  hash:     %s\n", payloadHash)
		fmt.Printf("  commit:   %s\n", message)
		if hasChanges {
			fmt.Println("  changes:  yes (would commit, tag, and push)")
		} else {
			fmt.Println("  changes:  no staged diff; would only create tag and push refs")
		}
		return
	}

	if hasChanges {
		if _, err := runGit(tmpDir, "commit", "-m", message); err != nil {
			fmt.Fprintf(os.Stderr, "error committing publish: %v\n", err)
			os.Exit(1)
		}
	}

	if _, err := runGit(tmpDir, "tag", tagRef); err != nil {
		fmt.Fprintf(os.Stderr, "error creating tag '%s': %v\n", tagRef, err)
		os.Exit(1)
	}

	if _, err := runGit(tmpDir, "push", "origin", templateName); err != nil {
		fmt.Fprintf(os.Stderr, "error pushing branch '%s': %v\n", templateName, err)
		os.Exit(1)
	}

	if _, err := runGit(tmpDir, "push", "origin", "refs/tags/"+tagRef); err != nil {
		fmt.Fprintf(os.Stderr, "error pushing tag '%s': %v\n", tagRef, err)
		os.Exit(1)
	}

	fmt.Printf("Published template '\033[36m%s\033[0m' version '\033[33m%s\033[0m'\n", templateName, tagVersion)
	fmt.Printf("  registry: %s\n", displayRegistry)
	if bumped {
		fmt.Printf("  requested version: %s\n", baseVersion)
	}
	fmt.Printf("  branch:   %s\n", templateName)
	fmt.Printf("  tag:      %s\n", tagRef)
	fmt.Printf("  hash:     %s\n", payloadHash)
	fmt.Printf("  source:   %s\n", scriptPath)
}

func defaultPublishRegistry() string {
	for _, r := range collectRegistries() {
		if isLocalGitRepoPath(r) {
			return r
		}
	}

	return ""
}

func normalizePublishVersion(templateName string, version string) (string, error) {
	trimmed := strings.TrimSpace(version)
	if trimmed == "" {
		return "", fmt.Errorf("empty version")
	}

	if strings.HasPrefix(trimmed, templateName+"/") {
		trimmed = strings.TrimPrefix(trimmed, templateName+"/")
	}

	if strings.Contains(trimmed, "/") {
		return "", fmt.Errorf("version should not include '/', use just the version segment (e.g. v1.0.0)")
	}

	return trimmed, nil
}

func normalizeRegistrySource(source string) (string, string) {
	trimmed := strings.TrimSpace(source)
	if trimmed == "" {
		return "", ""
	}

	if isLocalGitRepoPath(trimmed) {
		abs, err := filepath.Abs(trimmed)
		if err != nil {
			return "", ""
		}
		u := &url.URL{Scheme: "file", Path: filepath.ToSlash(abs)}
		return u.String(), abs
	}

	return trimmed, trimmed
}

func cloneRegistryForPublish(repoURL string, branch string) (string, func(), error) {
	tmpDir, err := os.MkdirTemp("", "forge-template-publish-*")
	if err != nil {
		return "", nil, fmt.Errorf("creating temp directory: %w", err)
	}
	cleanup := func() { _ = os.RemoveAll(tmpDir) }

	branchExists := false
	if output, err := runGit("", "ls-remote", "--heads", repoURL, "refs/heads/"+branch); err == nil {
		branchExists = strings.TrimSpace(output) != ""
	}

	if branchExists {
		if _, err := runGit("", "clone", "--quiet", "--depth", "1", "--single-branch", "--branch", branch, repoURL, tmpDir); err != nil {
			cleanup()
			return "", nil, err
		}
	} else {
		if _, err := runGit("", "clone", "--quiet", repoURL, tmpDir); err != nil {
			cleanup()
			return "", nil, err
		}
	}

	return tmpDir, cleanup, nil
}

func ensurePublishBranch(repoDir string, branch string) error {
	if _, err := runGit(repoDir, "checkout", "--quiet", branch); err == nil {
		return nil
	}

	_, err := runGit(repoDir, "checkout", "--quiet", "--orphan", branch)
	return err
}

func clearPublishWorkspace(repoDir string) error {
	entries, err := os.ReadDir(repoDir)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		if entry.Name() == ".git" {
			continue
		}
		if err := os.RemoveAll(filepath.Join(repoDir, entry.Name())); err != nil {
			return err
		}
	}

	return nil
}

func gitHasStagedChanges(repoDir string) (bool, error) {
	cmd := exec.Command("git", "-C", repoDir, "diff", "--cached", "--quiet")
	err := cmd.Run()
	if err == nil {
		return false, nil
	}

	if exitErr, ok := err.(*exec.ExitError); ok && exitErr.ExitCode() == 1 {
		return true, nil
	}

	return false, fmt.Errorf("checking git staged diff: %w", err)
}

func runGit(repoDir string, args ...string) (string, error) {
	fullArgs := args
	if strings.TrimSpace(repoDir) != "" {
		fullArgs = append([]string{"-C", repoDir}, args...)
	}

	cmd := exec.Command("git", fullArgs...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("git %s: %w: %s", strings.Join(args, " "), err, strings.TrimSpace(string(output)))
	}

	return string(output), nil
}

func isLocalGitRepoPath(path string) bool {
	info, err := os.Stat(path)
	if err != nil || !info.IsDir() {
		return false
	}

	cmd := exec.Command("git", "-C", path, "rev-parse", "--is-inside-work-tree")
	output, err := cmd.Output()
	if err != nil {
		return false
	}

	return strings.TrimSpace(string(output)) == "true"
}

func hashTemplatePayload(meta []byte, script []byte, example []byte) string {
	payload := append([]byte{}, meta...)
	payload = append(payload, script...)
	payload = append(payload, example...)
	sum := sha256.Sum256(payload)
	return hex.EncodeToString(sum[:])
}

func resolvePublishVersionByHash(repoURL string, templateName string, baseVersion string, ext string, payloadHash string) (string, bool, bool, error) {
	current := baseVersion
	bumped := false

	for attempts := 0; attempts < 200; attempts++ {
		tagRef := templateName + "/" + current
		exists, err := gitTagExistsRemote(repoURL, tagRef)
		if err != nil {
			return "", false, bumped, err
		}
		if !exists {
			return current, false, bumped, nil
		}

		existingHash, err := loadTemplateHashAtTag(repoURL, templateName, ext, tagRef)
		if err != nil {
			return "", false, bumped, err
		}
		if existingHash == payloadHash {
			return current, true, bumped, nil
		}

		next, err := bumpPatchVersion(current)
		if err != nil {
			return "", false, bumped, err
		}
		current = next
		bumped = true
	}

	return "", false, bumped, fmt.Errorf("unable to resolve version after multiple bump attempts")
}

func gitTagExistsRemote(repoURL string, tagRef string) (bool, error) {
	output, err := runGit("", "ls-remote", "--tags", "--refs", repoURL, "refs/tags/"+tagRef)
	if err != nil {
		return false, err
	}

	return strings.TrimSpace(output) != "", nil
}

func loadTemplateHashAtTag(repoURL string, templateName string, ext string, tagRef string) (string, error) {
	tmpDir, err := os.MkdirTemp("", "forge-template-hash-*")
	if err != nil {
		return "", fmt.Errorf("creating temp directory: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	if _, err := runGit("", "clone", "--quiet", "--depth", "1", "--branch", tagRef, repoURL, tmpDir); err != nil {
		return "", err
	}

	metaPath := filepath.Join(tmpDir, "template.yaml")
	metaData, err := os.ReadFile(metaPath)
	if err != nil {
		return "", fmt.Errorf("reading existing template.yaml for %s: %w", tagRef, err)
	}

	tryScript := []string{filepath.Join(tmpDir, templateName+ext)}
	for _, candidateExt := range []string{".go", ".ts", ".cs"} {
		candidate := filepath.Join(tmpDir, templateName+candidateExt)
		if candidate != tryScript[0] {
			tryScript = append(tryScript, candidate)
		}
	}

	var scriptData []byte
	for _, candidate := range tryScript {
		data, readErr := os.ReadFile(candidate)
		if readErr == nil {
			scriptData = data
			break
		}
	}
	if len(scriptData) == 0 {
		return "", fmt.Errorf("reading existing template script for %s", tagRef)
	}

	exampleData, _ := os.ReadFile(filepath.Join(tmpDir, "example.md"))

	return hashTemplatePayload(metaData, scriptData, exampleData), nil
}

func bumpPatchVersion(version string) (string, error) {
	v := strings.TrimSpace(version)
	prefix := ""
	if strings.HasPrefix(v, "v") {
		prefix = "v"
		v = strings.TrimPrefix(v, "v")
	}

	parts := strings.Split(v, ".")
	if len(parts) != 3 {
		return "", fmt.Errorf("cannot auto-bump version '%s' (expected semver like v1.2.3)", version)
	}

	major, err := strconv.Atoi(parts[0])
	if err != nil {
		return "", fmt.Errorf("cannot auto-bump version '%s'", version)
	}
	minor, err := strconv.Atoi(parts[1])
	if err != nil {
		return "", fmt.Errorf("cannot auto-bump version '%s'", version)
	}
	patch, err := strconv.Atoi(parts[2])
	if err != nil {
		return "", fmt.Errorf("cannot auto-bump version '%s'", version)
	}

	patch++
	return fmt.Sprintf("%s%d.%d.%d", prefix, major, minor, patch), nil
}
