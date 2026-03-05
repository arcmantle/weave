package commands

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/arcmantle/forge/internal/embedded"
	"github.com/arcmantle/forge/internal/manifest"
	"github.com/arcmantle/forge/internal/templates"
)

func runAdd(args []string) {
	if len(args) == 0 {
		fmt.Fprintf(os.Stderr, "error: forge add requires a command name\n")
		fmt.Fprintf(os.Stderr, "  usage: forge add <name> [--go|--ts|--cs] [--from <template[@ref]>] [--var key=value]\n")
		os.Exit(1)
	}

	name := args[0]
	lang := ""
	from := ""
	vars := map[string]string{}

	for i := 1; i < len(args); i++ {
		arg := args[i]
		switch {
		case arg == "--go":
			lang = "go"
		case arg == "--ts":
			lang = "ts"
		case arg == "--cs":
			lang = "cs"
		case arg == "--from":
			if i+1 >= len(args) {
				fmt.Fprintf(os.Stderr, "error: --from requires a template name or URL\n")
				os.Exit(1)
			}
			i++
			from = args[i]
		case strings.HasPrefix(arg, "--from="):
			from = strings.TrimPrefix(arg, "--from=")
		case arg == "--var":
			if i+1 >= len(args) {
				fmt.Fprintf(os.Stderr, "error: --var requires a key=value argument\n")
				os.Exit(1)
			}
			i++
			kv := args[i]
			eqIdx := strings.Index(kv, "=")
			if eqIdx == -1 {
				fmt.Fprintf(os.Stderr, "error: --var value must be key=value, got '%s'\n", kv)
				os.Exit(1)
			}
			vars[kv[:eqIdx]] = kv[eqIdx+1:]
		case strings.HasPrefix(arg, "--var="):
			kv := strings.TrimPrefix(arg, "--var=")
			eqIdx := strings.Index(kv, "=")
			if eqIdx == -1 {
				fmt.Fprintf(os.Stderr, "error: --var value must be key=value, got '%s'\n", kv)
				os.Exit(1)
			}
			vars[kv[:eqIdx]] = kv[eqIdx+1:]
		default:
			fmt.Fprintf(os.Stderr, "error: unknown flag '%s'\n", arg)
			fmt.Fprintf(os.Stderr, "  usage: forge add <name> [--go|--ts|--cs] [--from <template[@ref]>] [--var key=value]\n")
			os.Exit(1)
		}
	}

	if from != "" {
		runAddFromTemplate(name, lang, from, vars)
		return
	}

	if lang != "" {
		switch lang {
		case "go":
			if !hasGo() {
				fmt.Fprintf(os.Stderr, "error: Go is not installed (required for --go)\n")
				os.Exit(1)
			}
		case "ts":
			if !hasNode() {
				fmt.Fprintf(os.Stderr, "error: Node.js is not installed (required for --ts)\n")
				os.Exit(1)
			}
		case "cs":
			if !hasDotnet() {
				fmt.Fprintf(os.Stderr, "error: .NET SDK is not installed (required for --cs)\n")
				os.Exit(1)
			}
		}
	} else {
		switch {
		case hasGo():
			lang = "go"
		case hasNode():
			lang = "ts"
		case hasDotnet():
			lang = "cs"
		default:
			fmt.Fprintf(os.Stderr, "error: no supported runtime found (install Go, Node.js, or .NET SDK)\n")
			os.Exit(1)
		}
	}

	cwd, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	forgeDir := filepath.Join(cwd, manifest.ForgeDirName)
	if _, err := os.Stat(forgeDir); os.IsNotExist(err) {
		bootstrapForge(cwd, lang)
	}

	if existing := findDiscoveredCommand(name); existing {
		fmt.Fprintf(os.Stderr, "error: command '%s' already exists\n", name)
		os.Exit(1)
	}

	scriptDir, scriptName, err := commandScriptDirAndLeaf(cwd, name)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	if err := os.MkdirAll(scriptDir, 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "error creating script directory: %v\n", err)
		os.Exit(1)
	}

	var ext, scriptContent string
	switch lang {
	case "go":
		ext = ".go"
		scriptContent = fmt.Sprintf(`package main

import "github.com/arcmantle/forge/helpers"

func main() {
	helpers.Info("running %s")
}
`, name)
	case "ts":
		ext = ".ts"
		scriptContent = fmt.Sprintf(`import { info } from '#helpers';

info('running %s');
`, name)
	case "cs":
		ext = ".cs"
		scriptContent = fmt.Sprintf(`using Forge.Helpers;

Log.Info("running %s");
`, name)
	}

	scriptFile := filepath.Join(scriptDir, scriptName+ext)
	if err := os.WriteFile(scriptFile, []byte(scriptContent), 0o644); err != nil {
		fmt.Fprintf(os.Stderr, "error writing script: %v\n", err)
		os.Exit(1)
	}

	relScript := filepath.ToSlash(scriptName + ext)
	templatePath := filepath.Join(scriptDir, manifest.CommandTemplateFile)
	if err := writeCommandTemplate(templatePath, "", relScript); err != nil {
		fmt.Fprintf(os.Stderr, "error writing %s: %v\n", manifest.CommandTemplateFile, err)
		os.Exit(1)
	}
	examplePath := filepath.Join(scriptDir, "example.md")
	if err := writeCommandExample(examplePath, name, "", false); err != nil {
		fmt.Fprintf(os.Stderr, "error writing example.md: %v\n", err)
		os.Exit(1)
	}

	relTemplatePath, _ := filepath.Rel(cwd, templatePath)
	relScriptPath, _ := filepath.Rel(cwd, scriptFile)
	relExamplePath, _ := filepath.Rel(cwd, examplePath)

	fmt.Printf("Added command '\033[36m%s\033[0m' (%s)\n", name, lang)
	fmt.Printf("  script: %s\n", filepath.ToSlash(relScriptPath))
	fmt.Printf("  template: %s\n", filepath.ToSlash(relTemplatePath))
	fmt.Printf("  example: %s\n", filepath.ToSlash(relExamplePath))
}

func runAddFromTemplate(name, lang, from string, vars map[string]string) {
	registries := collectRegistries()

	tpl, err := templates.ResolveWithRegistries(from, registries)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	if len(tpl.CommandTemplates) > 0 || len(tpl.Meta.Run) > 0 {
		runAddBundleFromTemplate(name, lang, from, vars, tpl)
		return
	}

	if lang == "" {
		switch {
		case hasGo() && tpl.HasLanguage("go"):
			lang = "go"
		case hasNode() && tpl.HasLanguage("ts"):
			lang = "ts"
		case hasDotnet() && tpl.HasLanguage("cs"):
			lang = "cs"
		default:
			available := tpl.AvailableLanguages()
			if len(available) == 0 {
				fmt.Fprintf(os.Stderr, "error: template '%s' has no script files\n", from)
				os.Exit(1)
			}
			lang = available[0]
		}
	} else if !tpl.HasLanguage(lang) {
		fmt.Fprintf(os.Stderr, "error: template '%s' does not support %s (available: %s)\n",
			from, lang, strings.Join(tpl.AvailableLanguages(), ", "))
		os.Exit(1)
	}

	switch lang {
	case "go":
		if !hasGo() {
			fmt.Fprintf(os.Stderr, "error: Go is not installed (required for this template)\n")
			os.Exit(1)
		}
	case "ts":
		if !hasNode() {
			fmt.Fprintf(os.Stderr, "error: Node.js is not installed (required for this template)\n")
			os.Exit(1)
		}
	case "cs":
		if !hasDotnet() {
			fmt.Fprintf(os.Stderr, "error: .NET SDK is not installed (required for this template)\n")
			os.Exit(1)
		}
	}

	scriptContent, err := tpl.Apply(name, lang, vars)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	cwd, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	forgeDir := filepath.Join(cwd, manifest.ForgeDirName)
	if _, err := os.Stat(forgeDir); os.IsNotExist(err) {
		bootstrapForge(cwd, lang)
	}

	if existing := findDiscoveredCommand(name); existing {
		fmt.Fprintf(os.Stderr, "error: command '%s' already exists\n", name)
		os.Exit(1)
	}

	scriptDir, scriptName, err := commandScriptDirAndLeaf(cwd, name)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	if err := os.MkdirAll(scriptDir, 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "error creating script directory: %v\n", err)
		os.Exit(1)
	}

	ext := map[string]string{"go": ".go", "ts": ".ts", "cs": ".cs"}[lang]
	scriptFile := filepath.Join(scriptDir, scriptName+ext)
	if err := os.WriteFile(scriptFile, []byte(scriptContent), 0o644); err != nil {
		fmt.Fprintf(os.Stderr, "error writing script: %v\n", err)
		os.Exit(1)
	}

	relScript := filepath.ToSlash(scriptName + ext)
	templatePath := filepath.Join(scriptDir, manifest.CommandTemplateFile)
	if err := writeCommandTemplate(templatePath, tpl.Meta.Description, relScript); err != nil {
		fmt.Fprintf(os.Stderr, "error writing %s: %v\n", manifest.CommandTemplateFile, err)
		os.Exit(1)
	}
	examplePath := filepath.Join(scriptDir, "example.md")
	if err := writeCommandExample(examplePath, name, tpl.Meta.Description, true); err != nil {
		fmt.Fprintf(os.Stderr, "error writing example.md: %v\n", err)
		os.Exit(1)
	}

	relTemplatePath, _ := filepath.Rel(cwd, templatePath)
	relScriptPath, _ := filepath.Rel(cwd, scriptFile)
	relExamplePath, _ := filepath.Rel(cwd, examplePath)

	fmt.Printf("Added command '\033[36m%s\033[0m' from template '\033[33m%s\033[0m' (%s)\n", name, from, lang)
	fmt.Printf("  script: %s\n", filepath.ToSlash(relScriptPath))
	fmt.Printf("  template: %s\n", filepath.ToSlash(relTemplatePath))
	fmt.Printf("  example: %s\n", filepath.ToSlash(relExamplePath))

	if len(tpl.Meta.Variables) > 0 {
		fmt.Println("  variables:")
		for _, v := range tpl.Meta.Variables {
			value := v.Default
			if val, ok := vars[v.Name]; ok {
				value = val
			}
			fmt.Printf("    %s = %s\n", v.Name, value)
		}
	}

	fmt.Printf("\nCustomize the script at %s\n", filepath.ToSlash(relScriptPath))
}

func runAddBundleFromTemplate(name string, lang string, from string, vars map[string]string, tpl *templates.Template) {
	bundleLang, err := resolveBundleLanguage(tpl, lang)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	if bundleLang != "" {
		if err := ensureRuntimeForLanguage(bundleLang, "this template"); err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			os.Exit(1)
		}
	}

	cwd, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	childPlaceholderNames := make([]string, 0, len(tpl.CommandTemplates))
	for childPlaceholderName := range tpl.CommandTemplates {
		childPlaceholderNames = append(childPlaceholderNames, childPlaceholderName)
	}
	sort.Strings(childPlaceholderNames)

	targetCommandNames := make([]string, 0, len(childPlaceholderNames)+1)
	targetCommandNames = append(targetCommandNames, name)
	for _, childPlaceholderName := range childPlaceholderNames {
		targetCommandName := strings.ReplaceAll(childPlaceholderName, "__NAME__", name)
		targetCommandNames = append(targetCommandNames, targetCommandName)
	}

	if err := checkCommandNameCollisions(targetCommandNames); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	forgeDir := filepath.Join(cwd, manifest.ForgeDirName)
	if _, err := os.Stat(forgeDir); os.IsNotExist(err) {
		bootstrapForge(cwd, bundleLang)
	}

	rootScriptDir, rootScriptName, err := commandScriptDirAndLeaf(cwd, name)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	if err := os.MkdirAll(rootScriptDir, 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "error creating script directory: %v\n", err)
		os.Exit(1)
	}

	rootRun := rewriteRunWithNameToken(tpl.Meta.Run, name)
	rootRelScript := ""
	rootScriptPath := ""
	if bundleLang != "" && tpl.HasLanguage(bundleLang) {
		rootScriptContent, err := tpl.Apply(name, bundleLang, vars)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			os.Exit(1)
		}

		rootExt := map[string]string{"go": ".go", "ts": ".ts", "cs": ".cs"}[bundleLang]
		rootScriptPath = filepath.Join(rootScriptDir, rootScriptName+rootExt)
		if err := os.WriteFile(rootScriptPath, []byte(rootScriptContent), 0o644); err != nil {
			fmt.Fprintf(os.Stderr, "error writing script: %v\n", err)
			os.Exit(1)
		}
		rootRelScript = filepath.ToSlash(rootScriptName + rootExt)
	}
	if len(rootRun) == 0 && rootRelScript == "" && len(childPlaceholderNames) > 0 {
		rootRun = make([]manifest.RunStep, 0, len(childPlaceholderNames))
		for _, childPlaceholderName := range childPlaceholderNames {
			rootRun = append(rootRun, manifest.RunStep{Command: strings.ReplaceAll(childPlaceholderName, "__NAME__", name)})
		}
	}

	rootTemplatePath := filepath.Join(rootScriptDir, manifest.CommandTemplateFile)
	if err := writeCommandTemplateWithRun(rootTemplatePath, tpl.Meta.Description, rootRelScript, rootRun); err != nil {
		fmt.Fprintf(os.Stderr, "error writing %s: %v\n", manifest.CommandTemplateFile, err)
		os.Exit(1)
	}

	rootExamplePath := filepath.Join(rootScriptDir, "example.md")
	if err := writeCommandTemplateExample(rootExamplePath, name, tpl.Meta.Description, tpl.Meta.Example, true); err != nil {
		fmt.Fprintf(os.Stderr, "error writing example.md: %v\n", err)
		os.Exit(1)
	}

	type commandArtifact struct {
		Name         string
		TemplatePath string
		ScriptPath   string
		ExamplePath  string
	}

	childArtifacts := make([]commandArtifact, 0, len(childPlaceholderNames))
	for _, childPlaceholderName := range childPlaceholderNames {
		childTemplate, ok := tpl.CommandTemplates[childPlaceholderName]
		if !ok {
			continue
		}

		childName := strings.ReplaceAll(childPlaceholderName, "__NAME__", name)
		childScriptDir, childScriptName, err := commandScriptDirAndLeaf(cwd, childName)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			os.Exit(1)
		}

		if err := os.MkdirAll(childScriptDir, 0o755); err != nil {
			fmt.Fprintf(os.Stderr, "error creating script directory: %v\n", err)
			os.Exit(1)
		}

		childRun := rewriteRunWithNameToken(childTemplate.Meta.Run, name)
		childRelScript := ""
		childScriptPath := ""
		if bundleLang != "" && childTemplate.HasLanguage(bundleLang) {
			childScriptContent, err := childTemplate.Apply(childName, bundleLang, vars)
			if err != nil {
				fmt.Fprintf(os.Stderr, "error: %v\n", err)
				os.Exit(1)
			}

			childExt := map[string]string{"go": ".go", "ts": ".ts", "cs": ".cs"}[bundleLang]
			childScriptPath = filepath.Join(childScriptDir, childScriptName+childExt)
			if err := os.WriteFile(childScriptPath, []byte(childScriptContent), 0o644); err != nil {
				fmt.Fprintf(os.Stderr, "error writing script: %v\n", err)
				os.Exit(1)
			}
			childRelScript = filepath.ToSlash(childScriptName + childExt)
		}

		childTemplatePath := filepath.Join(childScriptDir, manifest.CommandTemplateFile)
		if err := writeCommandTemplateWithRun(childTemplatePath, childTemplate.Meta.Description, childRelScript, childRun); err != nil {
			fmt.Fprintf(os.Stderr, "error writing %s: %v\n", manifest.CommandTemplateFile, err)
			os.Exit(1)
		}

		childExamplePath := filepath.Join(childScriptDir, "example.md")
		if err := writeCommandTemplateExample(childExamplePath, childName, childTemplate.Meta.Description, childTemplate.Meta.Example, true); err != nil {
			fmt.Fprintf(os.Stderr, "error writing example.md: %v\n", err)
			os.Exit(1)
		}

		childArtifacts = append(childArtifacts, commandArtifact{
			Name:         childName,
			TemplatePath: childTemplatePath,
			ScriptPath:   childScriptPath,
			ExamplePath:  childExamplePath,
		})
	}

	rootRelTemplatePath, _ := filepath.Rel(cwd, rootTemplatePath)
	rootRelExamplePath, _ := filepath.Rel(cwd, rootExamplePath)
	rootRelScriptPath := ""
	if rootScriptPath != "" {
		rootRelScriptPath, _ = filepath.Rel(cwd, rootScriptPath)
	}

	if bundleLang != "" {
		fmt.Printf("Added command '\033[36m%s\033[0m' from template '\033[33m%s\033[0m' as bundle (%s)\n", name, from, bundleLang)
	} else {
		fmt.Printf("Added command '\033[36m%s\033[0m' from template '\033[33m%s\033[0m' as bundle\n", name, from)
	}

	fmt.Printf("  root %s:\n", name)
	fmt.Printf("    template: %s\n", filepath.ToSlash(rootRelTemplatePath))
	if rootRelScriptPath != "" {
		fmt.Printf("    script: %s\n", filepath.ToSlash(rootRelScriptPath))
	}
	fmt.Printf("    example: %s\n", filepath.ToSlash(rootRelExamplePath))

	if len(childArtifacts) > 0 {
		fmt.Println("  children:")
		for _, child := range childArtifacts {
			relTemplatePath, _ := filepath.Rel(cwd, child.TemplatePath)
			relExamplePath, _ := filepath.Rel(cwd, child.ExamplePath)
			relScriptPath := ""
			if child.ScriptPath != "" {
				relScriptPath, _ = filepath.Rel(cwd, child.ScriptPath)
			}

			fmt.Printf("    %s:\n", child.Name)
			fmt.Printf("      template: %s\n", filepath.ToSlash(relTemplatePath))
			if relScriptPath != "" {
				fmt.Printf("      script: %s\n", filepath.ToSlash(relScriptPath))
			}
			fmt.Printf("      example: %s\n", filepath.ToSlash(relExamplePath))
		}
	}

	if len(tpl.Meta.Variables) > 0 {
		fmt.Println("  variables:")
		for _, v := range tpl.Meta.Variables {
			value := v.Default
			if val, ok := vars[v.Name]; ok {
				value = val
			}
			fmt.Printf("    %s = %s\n", v.Name, value)
		}
	}
}

func resolveBundleLanguage(tpl *templates.Template, requestedLang string) (string, error) {
	bundleTemplatesWithScripts := []*templates.Template{}
	if len(tpl.Scripts) > 0 {
		bundleTemplatesWithScripts = append(bundleTemplatesWithScripts, tpl)
	}

	for _, childTemplate := range tpl.CommandTemplates {
		if len(childTemplate.Scripts) == 0 {
			continue
		}
		bundleTemplatesWithScripts = append(bundleTemplatesWithScripts, childTemplate)
	}

	if len(bundleTemplatesWithScripts) == 0 {
		return "", nil
	}

	supportedLangs := []string{}
	for index, commandTemplate := range bundleTemplatesWithScripts {
		commandSupported := map[string]bool{}
		for _, available := range commandTemplate.AvailableLanguages() {
			commandSupported[available] = true
		}

		if index == 0 {
			for available := range commandSupported {
				supportedLangs = append(supportedLangs, available)
			}
			continue
		}

		intersection := []string{}
		for _, existing := range supportedLangs {
			if commandSupported[existing] {
				intersection = append(intersection, existing)
			}
		}
		supportedLangs = intersection
	}

	supportedLangs = orderLanguagesForSelection(supportedLangs)
	if len(supportedLangs) == 0 {
		return "", fmt.Errorf("template '%s' has no common script language across bundle command templates", tpl.Name)
	}

	if strings.TrimSpace(requestedLang) != "" {
		for _, supported := range supportedLangs {
			if supported == requestedLang {
				return requestedLang, nil
			}
		}

		return "", fmt.Errorf("template '%s' does not support %s for all bundle scripts (available: %s)",
			tpl.Name, requestedLang, strings.Join(supportedLangs, ", "))
	}

	for _, candidate := range supportedLangs {
		switch candidate {
		case "go":
			if hasGo() {
				return candidate, nil
			}
		case "ts":
			if hasNode() {
				return candidate, nil
			}
		case "cs":
			if hasDotnet() {
				return candidate, nil
			}
		}
	}

	return supportedLangs[0], nil
}

func orderLanguagesForSelection(values []string) []string {
	seen := map[string]bool{}
	normalized := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" || seen[trimmed] {
			continue
		}
		seen[trimmed] = true
		normalized = append(normalized, trimmed)
	}

	preferred := []string{"go", "ts", "cs"}
	ordered := []string{}
	for _, candidate := range preferred {
		if seen[candidate] {
			ordered = append(ordered, candidate)
			delete(seen, candidate)
		}
	}

	rest := []string{}
	for _, value := range normalized {
		if seen[value] {
			rest = append(rest, value)
			delete(seen, value)
		}
	}
	sort.Strings(rest)

	return append(ordered, rest...)
}

func ensureRuntimeForLanguage(lang string, context string) error {
	switch lang {
	case "go":
		if !hasGo() {
			return fmt.Errorf("Go is not installed (required for %s)", context)
		}
	case "ts":
		if !hasNode() {
			return fmt.Errorf("Node.js is not installed (required for %s)", context)
		}
	case "cs":
		if !hasDotnet() {
			return fmt.Errorf(".NET SDK is not installed (required for %s)", context)
		}
	}

	return nil
}

func checkCommandNameCollisions(commandNames []string) error {
	existingCommands := discoveredCommandNames()
	planned := map[string]bool{}

	for _, commandName := range commandNames {
		trimmed := strings.TrimSpace(commandName)
		if trimmed == "" {
			return fmt.Errorf("invalid command name '%s'", commandName)
		}

		if planned[trimmed] {
			return fmt.Errorf("bundle template resolves duplicate command name '%s'", trimmed)
		}
	planned[trimmed] = true

		if existingCommands[trimmed] {
			return fmt.Errorf("command '%s' already exists", trimmed)
		}
	}

	return nil
}

func discoveredCommandNames() map[string]bool {
	commands := map[string]bool{}
	cwd, err := os.Getwd()
	if err != nil {
		return commands
	}

	manifests, err := manifest.DiscoverScripts(cwd)
	if err != nil || len(manifests) == 0 {
		return commands
	}

	merged := manifest.Merge(manifests)
	for commandName := range merged.Commands {
		commands[commandName] = true
	}

	return commands
}

func rewriteRunWithNameToken(run []manifest.RunStep, commandName string) []manifest.RunStep {
	if len(run) == 0 {
		return nil
	}

	rewritten := make([]manifest.RunStep, 0, len(run))
	for _, step := range run {
		next := manifest.RunStep{
			Command:  strings.ReplaceAll(strings.TrimSpace(step.Command), "__NAME__", commandName),
			Args:     make([]string, 0, len(step.Args)),
			Parallel: make([]string, 0, len(step.Parallel)),
		}

		for _, arg := range step.Args {
			next.Args = append(next.Args, strings.ReplaceAll(arg, "__NAME__", commandName))
		}

		for _, parallel := range step.Parallel {
			next.Parallel = append(next.Parallel, strings.ReplaceAll(parallel, "__NAME__", commandName))
		}

		rewritten = append(rewritten, next)
	}

	return rewritten
}

func findDiscoveredCommand(name string) bool {
	return discoveredCommandNames()[name]
}

func commandScriptDirAndLeaf(cwd string, commandName string) (string, string, error) {
	parts := strings.Split(commandName, ":")
	cleanParts := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" || trimmed == "." || trimmed == ".." || strings.Contains(trimmed, "/") || strings.Contains(trimmed, "\\") {
			return "", "", fmt.Errorf("invalid command name '%s'", commandName)
		}
		cleanParts = append(cleanParts, trimmed)
	}

	if len(cleanParts) == 0 {
		return "", "", fmt.Errorf("invalid command name '%s'", commandName)
	}

	leaf := cleanParts[len(cleanParts)-1]
	dirParts := append([]string{cwd, manifest.ForgeDirName, manifest.ScriptsDirName}, cleanParts...)

	return filepath.Join(dirParts...), leaf, nil
}

func writeCommandTemplate(path string, description string, script string) error {
	return writeCommandTemplateWithRun(path, description, script, nil)
}

func writeCommandTemplateWithRun(path string, description string, script string, run []manifest.RunStep) error {
	directive := commandTemplateSchemaDirective(path)
	trimmedScript := strings.TrimSpace(script)
	if trimmedScript == "" && len(run) == 0 {
		return fmt.Errorf("command template requires script or run")
	}

	var b strings.Builder
	if directive != "" {
		b.WriteString(directive)
		b.WriteString("\n")
	}
	b.WriteString("description: ")
	b.WriteString(yamlDoubleQuote(description))
	b.WriteString("\n")
	if trimmedScript != "" {
		b.WriteString("script: ")
		b.WriteString(trimmedScript)
		b.WriteString("\n")
	}

	if len(run) > 0 {
		b.WriteString("run:\n")
		for _, step := range run {
			if len(step.Parallel) > 0 {
				b.WriteString("  - parallel:\n")
				for _, parallel := range step.Parallel {
					b.WriteString("      - ")
					b.WriteString(yamlDoubleQuote(strings.TrimSpace(parallel)))
					b.WriteString("\n")
				}
				continue
			}

			command := strings.TrimSpace(step.Command)
			if len(step.Args) == 0 {
				b.WriteString("  - ")
				b.WriteString(yamlDoubleQuote(command))
				b.WriteString("\n")
				continue
			}

			b.WriteString("  - command: ")
			b.WriteString(yamlDoubleQuote(command))
			b.WriteString("\n")
			b.WriteString("    args:\n")
			for _, arg := range step.Args {
				b.WriteString("      - ")
				b.WriteString(yamlDoubleQuote(arg))
				b.WriteString("\n")
			}
		}
	}

	return os.WriteFile(path, []byte(b.String()), 0o644)
}

func writeCommandTemplateExample(path string, commandName string, description string, exampleContent string, fromTemplate bool) error {
	if strings.TrimSpace(exampleContent) != "" {
		return os.WriteFile(path, []byte(exampleContent), 0o644)
	}

	return writeCommandExample(path, commandName, description, fromTemplate)
}

func writeCommandExample(path string, commandName string, description string, fromTemplate bool) error {
	var b strings.Builder
	b.WriteString("# ")
	b.WriteString(commandName)
	b.WriteString("\n\n")
	if strings.TrimSpace(description) != "" {
		b.WriteString(description)
		b.WriteString("\n\n")
	}
	b.WriteString("## Run\n\n")
	b.WriteString("```bash\n")
	b.WriteString("forge ")
	b.WriteString(strings.ReplaceAll(commandName, ":", " "))
	b.WriteString("\n")
	b.WriteString("```\n")

	if fromTemplate {
		b.WriteString("\n## Notes\n\n")
		b.WriteString("This command was created from a template. Customize the script and metadata for your project.\n")
	}

	return os.WriteFile(path, []byte(b.String()), 0o644)
}

func commandTemplateSchemaDirective(templatePath string) string {
	templateDir := filepath.Dir(templatePath)
	dir := templateDir
	forgeDir := ""

	for {
		if filepath.Base(dir) == manifest.ForgeDirName {
			forgeDir = dir
			break
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}

		dir = parent
	}

	if forgeDir == "" {
		return ""
	}

	if _, err := embedded.ExtractTemplateSchema(forgeDir); err != nil {
		fmt.Fprintf(os.Stderr, "warning: could not extract template schema: %v\n", err)
	}

	relSchema, err := filepath.Rel(templateDir, filepath.Join(forgeDir, "template-schema.json"))
	if err != nil {
		return ""
	}

	return "# yaml-language-server: $schema=" + filepath.ToSlash(relSchema)
}

func yamlDoubleQuote(value string) string {
	escaped := strings.ReplaceAll(value, "\\", "\\\\")
	escaped = strings.ReplaceAll(escaped, "\"", "\\\"")

	return "\"" + escaped + "\""
}
