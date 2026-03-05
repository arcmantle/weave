package templates

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
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
	scope       string
	description string
	message     string
	dryRun      bool
}

func RunTemplatesPublish(args []string) {
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
		case arg == "--scope":
			if i+1 >= len(args) {
				fmt.Fprintf(os.Stderr, "error: --scope requires a value\n")
				os.Exit(1)
			}
			i++
			opts.scope = strings.TrimSpace(args[i])
		case strings.HasPrefix(arg, "--scope="):
			opts.scope = strings.TrimSpace(strings.TrimPrefix(arg, "--scope="))
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

	description := opts.description
	if description == "" {
		description = cmd.Description
	}
	if description == "" {
		description = fmt.Sprintf("Template for command %s", commandName)
	}

	scriptPath := ""
	payloadFiles := map[string][]byte{}
	isCompositeBundle := cmd.Script == "" && len(cmd.Run) > 0

	if isCompositeBundle {
		bundleFiles, sourceLabel, bundleErr := buildCompositeBundlePayloadFiles(m, commandName, description)
		if bundleErr != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", bundleErr)
			os.Exit(1)
		}

		scriptPath = sourceLabel
		payloadFiles = bundleFiles
	} else {
		if cmd.Script == "" {
			fmt.Fprintf(os.Stderr, "error: command '%s' does not define a script\n", commandName)
			os.Exit(1)
		}

		scriptPath = cmd.Script
		if !filepath.IsAbs(scriptPath) {
			scriptPath = filepath.Join(cmd.ManifestDir, scriptPath)
		}
		scriptPath = filepath.Clean(scriptPath)

		scriptData, readErr := os.ReadFile(scriptPath)
		if readErr != nil {
			fmt.Fprintf(os.Stderr, "error reading script %s: %v\n", scriptPath, readErr)
			os.Exit(1)
		}

		ext := strings.ToLower(filepath.Ext(scriptPath))
		switch ext {
		case ".go", ".ts", ".cs":
		default:
			fmt.Fprintf(os.Stderr, "error: script '%s' has unsupported extension '%s' (expected .go, .ts, or .cs)\n", scriptPath, ext)
			os.Exit(1)
		}

		exampleData := []byte{}
		examplePath := filepath.Join(filepath.Dir(scriptPath), "example.md")
		if data, err := os.ReadFile(examplePath); err == nil {
			exampleData = data
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

		payloadFiles["template.yaml"] = metaBytes
		payloadFiles[templateName+ext] = scriptData
		if len(exampleData) > 0 {
			payloadFiles["example.md"] = exampleData
		}
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
	githubRepo, isGitHubRegistry := parseGitHubRepoCoordinates(cloneURL)

	publishFiles := payloadFiles
	if isGitHubRegistry {
		publishFiles = prefixedPayloadFiles(payloadFiles, templateName)
	}

	payloadHash := hashTemplatePayloadFiles(publishFiles)

	if isGitHubRegistry {
		token, err := templates.ResolveGitHubToken()
		if err != nil {
			fmt.Fprintf(os.Stderr, "error resolving github token: %v\n", err)
			os.Exit(1)
		}

		actorLogin, err := githubGetAuthenticatedLogin(token)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error resolving github user: %v\n", err)
			os.Exit(1)
		}

		scopeBranch := strings.TrimSpace(opts.scope)
		if scopeBranch == "" {
			scopeBranch = actorLogin
		}
		if strings.Contains(scopeBranch, " ") {
			fmt.Fprintf(os.Stderr, "error: invalid scope branch '%s'\n", scopeBranch)
			os.Exit(1)
		}

		packageName := scopeBranch + "/" + templateName
		baseVersion, err := normalizePublishVersion(packageName, opts.version)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			os.Exit(1)
		}

		tagVersion, sameAsExistingTag, bumped, err := resolvePublishVersionByHash(cloneURL, packageName, baseVersion, publishFiles)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error resolving publish version: %v\n", err)
			os.Exit(1)
		}
		tagRef := packageName + "/" + tagVersion

		if sameAsExistingTag {
			fmt.Printf("Template '\033[36m%s\033[0m' version '\033[33m%s\033[0m' already published (same hash).\n", packageName, tagVersion)
			fmt.Printf("  registry: %s\n", displayRegistry)
			fmt.Printf("  tag:      %s\n", tagRef)
			fmt.Printf("  hash:     %s\n", payloadHash)
			return
		}

		if err := githubEnsureScopeBranch(token, githubRepo, scopeBranch); err != nil {
			fmt.Fprintf(os.Stderr, "error ensuring github scope branch '%s': %v\n", scopeBranch, err)
			os.Exit(1)
		}

		publishHeadBranch := githubPublishHeadBranch(actorLogin, templateName)

		tmpDir, cleanup, err := cloneRegistryForPublish(cloneURL, scopeBranch)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error preparing publish workspace: %v\n", err)
			os.Exit(1)
		}
		defer cleanup()

		if _, err := runGit(tmpDir, "checkout", "--quiet", "-B", publishHeadBranch); err != nil {
			fmt.Fprintf(os.Stderr, "error preparing publish head branch '%s': %v\n", publishHeadBranch, err)
			os.Exit(1)
		}

		targetDir := filepath.Join(tmpDir, templateName)
		if err := os.RemoveAll(targetDir); err != nil {
			fmt.Fprintf(os.Stderr, "error clearing scoped template directory: %v\n", err)
			os.Exit(1)
		}
		if err := os.MkdirAll(targetDir, 0o755); err != nil {
			fmt.Fprintf(os.Stderr, "error creating scoped template directory: %v\n", err)
			os.Exit(1)
		}

		if err := writePayloadFiles(tmpDir, publishFiles); err != nil {
			fmt.Fprintf(os.Stderr, "error writing template payload files: %v\n", err)
			os.Exit(1)
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
			fmt.Printf("Dry run for template publish '\033[36m%s\033[0m' version '\033[33m%s\033[0m' (github scoped PR)\n", templateName, tagVersion)
			fmt.Printf("  registry: %s\n", displayRegistry)
			if bumped {
				fmt.Printf("  requested version: %s\n", baseVersion)
			}
			fmt.Printf("  scope:    %s\n", scopeBranch)
			fmt.Printf("  pr head:  %s\n", publishHeadBranch)
			fmt.Printf("  tag:      %s (created by repository workflow after merge)\n", tagRef)
			fmt.Printf("  source:   %s\n", scriptPath)
			fmt.Printf("  files:    %d\n", len(publishFiles))
			fmt.Printf("  hash:     %s\n", payloadHash)
			fmt.Printf("  commit:   %s\n", message)
			if hasChanges {
				fmt.Println("  changes:  yes (would commit, push pr head, and open a pull request)")
			} else {
				fmt.Println("  changes:  no staged diff; would create an empty commit, push pr head, and open a pull request")
			}
			return
		}

		commitArgs := []string{"commit", "-m", message}
		if !hasChanges {
			commitArgs = []string{"commit", "--allow-empty", "-m", message}
		}
		if _, err := runGit(tmpDir, commitArgs...); err != nil {
			fmt.Fprintf(os.Stderr, "error committing publish: %v\n", err)
			os.Exit(1)
		}

		if _, err := runGit(tmpDir, "push", "origin", "refs/heads/"+publishHeadBranch); err != nil {
			fmt.Fprintf(os.Stderr, "error pushing publish head branch '%s': %v\n", publishHeadBranch, err)
			os.Exit(1)
		}

		prTitle := fmt.Sprintf("publish template %s@%s", templateName, tagVersion)
		prBody := fmt.Sprintf("Automated publish request from forge.\n\n- template: `%s`\n- package: `%s`\n- scope branch: `%s`\n- version: `%s`\n- tag: `%s`\n- payload hash: `%s`\n- source command: `%s`\n", templateName, packageName, scopeBranch, tagVersion, tagRef, payloadHash, commandName)
		prNumber, prURL, err := githubCreatePullRequest(token, githubRepo, prTitle, publishHeadBranch, scopeBranch, prBody)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error creating publish pull request: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("Opened publish pull request for template '\033[36m%s\033[0m' version '\033[33m%s\033[0m'\n", templateName, tagVersion)
		fmt.Printf("  registry: %s\n", displayRegistry)
		if bumped {
			fmt.Printf("  requested version: %s\n", baseVersion)
		}
		fmt.Printf("  scope:    %s\n", scopeBranch)
		fmt.Printf("  pr head:  %s\n", publishHeadBranch)
		fmt.Printf("  pr:       #%d %s\n", prNumber, prURL)
		fmt.Printf("  tag:      %s (created by repository workflow after merge)\n", tagRef)
		fmt.Printf("  hash:     %s\n", payloadHash)
		fmt.Printf("  source:   %s\n", scriptPath)
		return
	}

	baseVersion, err := normalizePublishVersion(templateName, opts.version)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	tagVersion, sameAsExistingTag, bumped, err := resolvePublishVersionByHash(cloneURL, templateName, baseVersion, publishFiles)
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

	if err := writePayloadFiles(tmpDir, publishFiles); err != nil {
		fmt.Fprintf(os.Stderr, "error writing template payload files: %v\n", err)
		os.Exit(1)
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
		fmt.Printf("  files:    %d\n", len(publishFiles))
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

func prefixedPayloadFiles(payloadFiles map[string][]byte, prefix string) map[string][]byte {
	cleanPrefix := strings.Trim(filepath.ToSlash(strings.TrimSpace(prefix)), "/")
	if cleanPrefix == "" {
		cloned := make(map[string][]byte, len(payloadFiles))
		for relPath, data := range payloadFiles {
			cloned[filepath.ToSlash(strings.TrimSpace(relPath))] = append([]byte{}, data...)
		}
		return cloned
	}

	prefixed := make(map[string][]byte, len(payloadFiles))
	for relPath, data := range payloadFiles {
		cleanPath := strings.Trim(filepath.ToSlash(strings.TrimSpace(relPath)), "/")
		if cleanPath == "" {
			continue
		}
		prefixed[cleanPrefix+"/"+cleanPath] = append([]byte{}, data...)
	}

	return prefixed
}

func writePayloadFiles(baseDir string, payloadFiles map[string][]byte) error {
	for relPath, data := range payloadFiles {
		clean := strings.Trim(filepath.ToSlash(strings.TrimSpace(relPath)), "/")
		if clean == "" {
			continue
		}

		targetPath := filepath.Join(baseDir, filepath.FromSlash(clean))
		if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
			return err
		}
		if err := os.WriteFile(targetPath, data, 0o644); err != nil {
			return err
		}
	}

	return nil
}

func buildCompositeBundlePayloadFiles(m *manifest.Manifest, rootCommandName string, description string) (map[string][]byte, string, error) {
	order, err := collectCompositeCommandOrder(rootCommandName, m.Commands)
	if err != nil {
		return nil, "", err
	}
	if len(order) == 0 {
		return nil, "", fmt.Errorf("no commands discovered for composite publish")
	}

	nameMap := buildCompositePlaceholderNames(order)
	rootCommand, ok := m.Commands[rootCommandName]
	if !ok {
		return nil, "", fmt.Errorf("composite root command '%s' not found", rootCommandName)
	}

	rootRun := rewriteRunSteps(rootCommand.Run, nameMap)
	rootExample, err := readCommandExampleData(rootCommand, rootCommandName)
	if err != nil {
		return nil, "", err
	}

	payloadFiles := map[string][]byte{}

	commandEntries := make([]templates.TemplateCommand, 0, len(order)-1)
	for _, originalName := range order[1:] {
		placeholderName := nameMap[originalName]
		commandPath, commandScriptName, err := commandBundlePath(placeholderName)
		if err != nil {
			return nil, "", err
		}

		commandEntries = append(commandEntries, templates.TemplateCommand{
			Name:   placeholderName,
			Path:   commandPath,
			Script: commandScriptName,
		})
	}

	sort.Slice(commandEntries, func(i, j int) bool {
		return commandEntries[i].Name < commandEntries[j].Name
	})

	rootMeta := templates.TemplateMeta{
		Description: description,
		Example:     string(rootExample),
		Run:         rootRun,
		Commands:    commandEntries,
	}
	rootMetaBytes, err := yaml.Marshal(&rootMeta)
	if err != nil {
		return nil, "", fmt.Errorf("encoding composite root template metadata: %w", err)
	}
	payloadFiles["template.yaml"] = rootMetaBytes
	if len(rootExample) > 0 {
		payloadFiles["example.md"] = rootExample
	}

	for _, originalName := range order[1:] {
		command, exists := m.Commands[originalName]
		if !exists {
			return nil, "", fmt.Errorf("command '%s' not found while building composite bundle", originalName)
		}

		placeholderName := nameMap[originalName]
		commandPath, commandScriptName, err := commandBundlePath(placeholderName)
		if err != nil {
			return nil, "", err
		}

		exampleData, err := readCommandExampleData(command, originalName)
		if err != nil {
			return nil, "", err
		}

		childMeta := templates.TemplateMeta{
			Description: command.Description,
			Example:     string(exampleData),
			Run:         rewriteRunSteps(command.Run, nameMap),
		}
		childMetaBytes, err := yaml.Marshal(&childMeta)
		if err != nil {
			return nil, "", fmt.Errorf("encoding child command metadata for '%s': %w", originalName, err)
		}
		payloadFiles[filepath.ToSlash(filepath.Join(commandPath, "template.yaml"))] = childMetaBytes

		scriptPath, scriptData, scriptExt, err := readCommandScriptForPublish(command)
		if err != nil {
			return nil, "", fmt.Errorf("reading child command script for '%s': %w", originalName, err)
		}
		if len(scriptData) > 0 {
			payloadFiles[filepath.ToSlash(filepath.Join(commandPath, commandScriptName+scriptExt))] = scriptData
			_ = scriptPath
		}

		if len(exampleData) > 0 {
			payloadFiles[filepath.ToSlash(filepath.Join(commandPath, "example.md"))] = exampleData
		}
	}

	return payloadFiles, fmt.Sprintf("<composite bundle for %s>", rootCommandName), nil
}

func readCommandScriptForPublish(command manifest.Command) (string, []byte, string, error) {
	if strings.TrimSpace(command.Script) == "" {
		return "", nil, "", nil
	}

	scriptPath := command.Script
	if !filepath.IsAbs(scriptPath) {
		scriptPath = filepath.Join(command.ManifestDir, scriptPath)
	}
	scriptPath = filepath.Clean(scriptPath)

	data, err := os.ReadFile(scriptPath)
	if err != nil {
		return "", nil, "", err
	}

	ext := strings.ToLower(filepath.Ext(scriptPath))
	switch ext {
	case ".go", ".ts", ".cs":
	default:
		return "", nil, "", fmt.Errorf("script '%s' has unsupported extension '%s' (expected .go, .ts, or .cs)", scriptPath, ext)
	}

	return scriptPath, data, ext, nil
}

func readCommandExampleData(command manifest.Command, commandName string) ([]byte, error) {
	commandParts := strings.Split(commandName, ":")
	examplePath := filepath.Join(append([]string{command.ManifestDir, manifest.ForgeDirName, manifest.ScriptsDirName}, commandParts...)...)
	examplePath = filepath.Join(examplePath, "example.md")

	data, err := os.ReadFile(examplePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	return data, nil
}

func collectCompositeCommandOrder(root string, commands map[string]manifest.Command) ([]string, error) {
	if _, ok := commands[root]; !ok {
		return nil, fmt.Errorf("root composite command '%s' not found", root)
	}

	seen := map[string]bool{}
	stack := map[string]bool{}
	order := []string{}

	var visit func(string) error
	visit = func(name string) error {
		if seen[name] {
			return nil
		}
		if stack[name] {
			return fmt.Errorf("detected recursive composite dependency at '%s'", name)
		}

		command, ok := commands[name]
		if !ok {
			return nil
		}

		stack[name] = true
		seen[name] = true
		order = append(order, name)

		for _, ref := range commandRunReferences(command.Run) {
			if _, exists := commands[ref]; !exists {
				continue
			}
			if err := visit(ref); err != nil {
				return err
			}
		}

		delete(stack, name)
		return nil
	}

	if err := visit(root); err != nil {
		return nil, err
	}

	return order, nil
}

func commandRunReferences(run []manifest.RunStep) []string {
	refs := []string{}
	for _, step := range run {
		if cmd := strings.TrimSpace(step.Command); cmd != "" {
			refs = append(refs, cmd)
		}

		for _, parallel := range step.Parallel {
			parts := tokenizeRunCommand(parallel)
			if len(parts) == 0 {
				continue
			}
			refs = append(refs, strings.TrimSpace(parts[0]))
		}
	}

	return refs
}

func tokenizeRunCommand(command string) []string {
	parts := strings.Fields(strings.TrimSpace(command))
	if len(parts) == 0 {
		return nil
	}

	return parts
}

func buildCompositePlaceholderNames(order []string) map[string]string {
	nameMap := map[string]string{}
	if len(order) == 0 {
		return nameMap
	}

	nameMap[order[0]] = "__NAME__"
	used := map[string]bool{"__NAME__": true}

	for _, original := range order[1:] {
		suffix := sanitizeGitRefSegment(strings.ReplaceAll(original, ":", "-"))
		if suffix == "" {
			suffix = "cmd"
		}

		candidate := "__NAME__:" + suffix
		if used[candidate] {
			for i := 2; ; i++ {
				next := fmt.Sprintf("%s-%d", candidate, i)
				if !used[next] {
					candidate = next
					break
				}
			}
		}

		used[candidate] = true
		nameMap[original] = candidate
	}

	return nameMap
}

func rewriteRunSteps(run []manifest.RunStep, nameMap map[string]string) []manifest.RunStep {
	if len(run) == 0 {
		return nil
	}

	result := make([]manifest.RunStep, 0, len(run))
	for _, step := range run {
		next := manifest.RunStep{
			Command:  strings.TrimSpace(step.Command),
			Args:     append([]string{}, step.Args...),
			Parallel: append([]string{}, step.Parallel...),
		}

		if replacement, ok := nameMap[next.Command]; ok {
			next.Command = replacement
		}

		for index, parallel := range next.Parallel {
			parts := tokenizeRunCommand(parallel)
			if len(parts) == 0 {
				continue
			}

			if replacement, ok := nameMap[strings.TrimSpace(parts[0])]; ok {
				parts[0] = replacement
				next.Parallel[index] = strings.Join(parts, " ")
			}
		}

		result = append(result, next)
	}

	return result
}

func commandBundlePath(placeholderName string) (string, string, error) {
	suffix := strings.TrimSpace(strings.TrimPrefix(placeholderName, "__NAME__:"))
	if suffix == "" || suffix == placeholderName {
		return "", "", fmt.Errorf("invalid bundle command placeholder '%s'", placeholderName)
	}

	cleanSuffix := strings.Trim(filepath.ToSlash(suffix), "/")
	commandPath := filepath.ToSlash(filepath.Join("commands", cleanSuffix))
	scriptName := filepath.Base(cleanSuffix)

	if scriptName == "" || scriptName == "." || scriptName == ".." {
		return "", "", fmt.Errorf("invalid bundle command script name for placeholder '%s'", placeholderName)
	}

	return commandPath, scriptName, nil
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

func hashTemplatePayloadFiles(payloadFiles map[string][]byte) string {
	if len(payloadFiles) == 0 {
		sum := sha256.Sum256(nil)
		return hex.EncodeToString(sum[:])
	}

	keys := make([]string, 0, len(payloadFiles))
	for key := range payloadFiles {
		keys = append(keys, filepath.ToSlash(strings.TrimSpace(key)))
	}
	sort.Strings(keys)

	h := sha256.New()
	for _, key := range keys {
		h.Write([]byte(key))
		h.Write([]byte{0})
		h.Write(payloadFiles[key])
		h.Write([]byte{0})
	}

	return hex.EncodeToString(h.Sum(nil))
}

func resolvePublishVersionByHash(repoURL string, templateName string, baseVersion string, payloadFiles map[string][]byte) (string, bool, bool, error) {
	current := baseVersion
	bumped := false
	payloadHash := hashTemplatePayloadFiles(payloadFiles)

	for attempts := 0; attempts < 200; attempts++ {
		tagRef := templateName + "/" + current
		exists, err := gitTagExistsRemote(repoURL, tagRef)
		if err != nil {
			return "", false, bumped, err
		}
		if !exists {
			return current, false, bumped, nil
		}

		existingHash, err := loadTemplateHashAtTag(repoURL, tagRef, payloadFiles)
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

func loadTemplateHashAtTag(repoURL string, tagRef string, payloadFiles map[string][]byte) (string, error) {
	tmpDir, err := os.MkdirTemp("", "forge-template-hash-*")
	if err != nil {
		return "", fmt.Errorf("creating temp directory: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	if _, err := runGit("", "clone", "--quiet", "--depth", "1", "--branch", tagRef, repoURL, tmpDir); err != nil {
		return "", err
	}

	actualFiles := make(map[string][]byte, len(payloadFiles))
	for relPath := range payloadFiles {
		clean := filepath.ToSlash(strings.TrimSpace(relPath))
		if clean == "" {
			continue
		}

		data, readErr := os.ReadFile(filepath.Join(tmpDir, filepath.FromSlash(clean)))
		if readErr != nil {
			return "", fmt.Errorf("reading existing template file %s for %s: %w", clean, tagRef, readErr)
		}

		actualFiles[clean] = data
	}

	return hashTemplatePayloadFiles(actualFiles), nil
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
