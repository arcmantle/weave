package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"

	"github.com/arcmantle/forge/internal/docs"
	"github.com/arcmantle/forge/internal/embedded"
	"github.com/arcmantle/forge/internal/manifest"
	"github.com/arcmantle/forge/internal/runner"
	"github.com/arcmantle/forge/internal/templates"
)

// version is set at build time via -ldflags.
var version = "dev"

// Runtime detection — check which language toolchains are available.

func hasGo() bool {
	_, err := exec.LookPath("go")
	return err == nil
}

func hasNode() bool {
	_, err := exec.LookPath("node")
	return err == nil
}

func hasDotnet() bool {
	_, err := exec.LookPath("dotnet")
	return err == nil
}

func hasPnpm() bool {
	_, err := exec.LookPath("pnpm")
	return err == nil
}

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(0)
	}

	command := os.Args[1]
	args := os.Args[2:]

	switch command {
	case "--help", "-h":
		printUsage()
	case "--version", "-v":
		fmt.Printf("forge %s\n", version)
	case "--list", "-l":
		listCommands()
	case "--docs":
		runDocs()
	case "--docs-serve":
		runDocsServe()
	case "init":
		runInit()
	case "add":
		runAdd(args)
	case "setup":
		runSetup(args)
	case "templates":
		runTemplates(args)
	case "auth":
		runAuth(args)
	case "help":
		runHelp(args)
	default:
		runCommand(os.Args[1:])
	}
}

func printUsage() {
	fmt.Println(mainUsageText)
}

func getManifest() *manifest.Manifest {
	cwd, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: could not get working directory: %v\n", err)
		os.Exit(1)
	}

	scriptManifests, err := manifest.DiscoverScripts(cwd)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	if len(scriptManifests) == 0 {
		fmt.Fprintf(os.Stderr, "error: no .forge/scripts/ found in current or parent directories\n")
		fmt.Fprintf(os.Stderr, "  run 'forge init' to scaffold one\n")
		os.Exit(1)
	}

	return manifest.Merge(scriptManifests)
}

// getFullManifest combines upward and downward discovery, returning commands
// from the entire project tree. Used by --docs and --list where a global
// view of all commands is desirable.
func getFullManifest() *manifest.Manifest {
	cwd, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: could not get working directory: %v\n", err)
		os.Exit(1)
	}

	scriptManifests, err := manifest.DiscoverScripts(cwd)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	downScriptManifests, err := manifest.DiscoverScriptsDown(cwd)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	if len(scriptManifests) == 0 && len(downScriptManifests) == 0 {
		fmt.Fprintf(os.Stderr, "error: no .forge/scripts/ found in current, parent, or child directories\n")
		fmt.Fprintf(os.Stderr, "  run 'forge init' to scaffold one\n")
		os.Exit(1)
	}

	// Merge order: downward scripts, then upward scripts.
	// Later entries win in Merge, so upward (closest) has highest priority.
	all := append(downScriptManifests, scriptManifests...)

	return manifest.Merge(all)
}

// resolveCommand performs greedy longest-match resolution on CLI tokens.
// It joins tokens with ":" from longest to shortest to find the deepest
// matching command. Returns the resolved command name and remaining args.
//
// Example: ["deploy", "staging", "--dryrun"] tries:
//   deploy:staging:--dryrun → deploy:staging → deploy
// If "deploy:staging" exists, returns ("deploy:staging", ["--dryrun"]).
func resolveCommand(tokens []string, commands map[string]manifest.Command) (string, []string) {
	// Try joining progressively fewer tokens.
	for n := len(tokens); n > 0; n-- {
		candidate := strings.Join(tokens[:n], ":")
		if _, ok := commands[candidate]; ok {
			return candidate, tokens[n:]
		}
	}

	// No match — return the first token so the caller can show an error.
	return tokens[0], tokens[1:]
}

// commandsWithPrefix returns all command names that start with prefix + ":".
func commandsWithPrefix(prefix string, commands map[string]manifest.Command) []string {
	var matches []string
	pfx := prefix + ":"
	for name := range commands {
		if strings.HasPrefix(name, pfx) {
			matches = append(matches, name)
		}
	}
	sort.Strings(matches)

	return matches
}

func listCommands() {
	m := getFullManifest()

	if len(m.Commands) == 0 {
		fmt.Println("No commands defined.")
		return
	}

	cwd, _ := os.Getwd()
	cwdClean := filepath.Clean(cwd)

	// Partition commands by source directory.
	type sourceGroup struct {
		relPath  string
		commands map[string]manifest.Command
	}

	bySource := map[string]*sourceGroup{}
	var sourceOrder []string

	for name, cmd := range m.Commands {
		dir := filepath.Clean(cmd.ManifestDir)
		if _, ok := bySource[dir]; !ok {
			rel, err := filepath.Rel(cwdClean, dir)
			if err != nil {
				rel = dir
			}

			// Normalize to forward slashes and use "." for cwd.
			rel = filepath.ToSlash(rel)
			if rel == "." {
				rel = ""
			}

			bySource[dir] = &sourceGroup{
				relPath:  rel,
				commands: make(map[string]manifest.Command),
			}
			sourceOrder = append(sourceOrder, dir)
		}
		bySource[dir].commands[name] = cmd
	}

	// Sort sources: local (empty relPath) first, then alphabetical.
	sort.Slice(sourceOrder, func(i, j int) bool {
		a, b := bySource[sourceOrder[i]].relPath, bySource[sourceOrder[j]].relPath
		if a == "" {
			return true
		}
		if b == "" {
			return false
		}

		return a < b
	})

	hasMultipleSources := len(sourceOrder) > 1

	fmt.Println("Available commands:")

	for _, dir := range sourceOrder {
		sg := bySource[dir]

		if hasMultipleSources {
			if sg.relPath == "" {
				fmt.Printf("\n  \033[33m[local]\033[0m\n")
			} else {
				fmt.Printf("\n  \033[33m[%s]\033[0m\n", sg.relPath)
			}
		} else {
			fmt.Println()
		}

		printCommandGroup(sg.commands)
	}
}

// printCommandGroup prints a sorted, colon-grouped set of commands.
func printCommandGroup(commands map[string]manifest.Command) {
	names := make([]string, 0, len(commands))
	for name := range commands {
		names = append(names, name)
	}
	sort.Strings(names)

	type group struct {
		children []string
	}
	groups := map[string]*group{}
	var topLevel []string

	for _, name := range names {
		if idx := strings.Index(name, ":"); idx != -1 {
			prefix := name[:idx]
			g, ok := groups[prefix]
			if !ok {
				g = &group{}
				groups[prefix] = g
			}
			g.children = append(g.children, name)
		} else {
			topLevel = append(topLevel, name)
		}
	}

	var displayOrder []string
	shown := map[string]bool{}
	for _, name := range topLevel {
		displayOrder = append(displayOrder, name)
		shown[name] = true
	}
	for prefix := range groups {
		if !shown[prefix] {
			displayOrder = append(displayOrder, prefix)
		}
	}
	sort.Strings(displayOrder)

	maxLen := 0
	for _, name := range displayOrder {
		if len(name) > maxLen {
			maxLen = len(name)
		}
		if g, ok := groups[name]; ok {
			for _, child := range g.children {
				suffix := child[strings.LastIndex(child, ":")+1:]
				padded := len(suffix) + 2
				if padded > maxLen {
					maxLen = padded
				}
			}
		}
	}

	for _, name := range displayOrder {
		if cmd, ok := commands[name]; ok {
			desc := cmd.Description
			if desc == "" {
				desc = "\033[90m(no description)\033[0m"
			}
			fmt.Printf("  \033[36m%-*s\033[0m  %s\n", maxLen, name, desc)
		} else {
			fmt.Printf("  \033[36m%s\033[0m\n", name)
		}

		if g, ok := groups[name]; ok {
			for _, child := range g.children {
				suffix := child[strings.LastIndex(child, ":")+1:]
				desc := commands[child].Description
				if desc == "" {
					desc = "\033[90m(no description)\033[0m"
				}
				fmt.Printf("    \033[36m%-*s\033[0m  %s\n", maxLen-2, suffix, desc)
			}
		}
	}
}

func runDocs() {
	// Re-exec ourselves with --docs-serve as a detached background process.
	exePath, err := os.Executable()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	cmd := exec.Command(exePath, "--docs-serve")
	cmd.Dir, _ = os.Getwd()
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	detachProcess(cmd)

	if err := cmd.Start(); err != nil {
		fmt.Fprintf(os.Stderr, "error starting docs server: %v\n", err)
		os.Exit(1)
	}
}

func runDocsServe() {
	m := getFullManifest()
	if err := docs.Serve(m, version); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}

func runCommand(tokens []string) {
	m := getManifest()

	name, args := resolveCommand(tokens, m.Commands)

	cmd, ok := m.Commands[name]
	if !ok {
		// Check if this is a group prefix with subcommands.
		children := commandsWithPrefix(name, m.Commands)
		if len(children) > 0 {
			fmt.Fprintf(os.Stderr, "error: '%s' is a command group, not a runnable command\n", name)
			fmt.Fprintf(os.Stderr, "\nAvailable subcommands:\n")
			for _, child := range children {
				suffix := child[len(name)+1:]
				desc := m.Commands[child].Description
				if desc != "" {
					fmt.Fprintf(os.Stderr, "  \033[36m%s\033[0m  %s\n", suffix, desc)
				} else {
					fmt.Fprintf(os.Stderr, "  \033[36m%s\033[0m\n", suffix)
				}
			}
			os.Exit(1)
		}

		fmt.Fprintf(os.Stderr, "error: unknown command '%s'\n", name)
		fmt.Fprintf(os.Stderr, "\nDid you mean one of these?\n")

		// Fuzzy matching — match against full name or suffix after last colon.
		for cmdName := range m.Commands {
			suffix := cmdName
			if idx := strings.LastIndex(cmdName, ":"); idx != -1 {
				suffix = cmdName[idx+1:]
			}
			if strings.Contains(cmdName, name) || strings.Contains(suffix, name) ||
				strings.HasPrefix(cmdName, name[:min(3, len(name))]) {
				fmt.Fprintf(os.Stderr, "  %s\n", cmdName)
			}
		}

		fmt.Fprintf(os.Stderr, "\nRun 'forge --list' to see all available commands.\n")
		os.Exit(1)
	}

	if err := runner.Run(cmd, m, args); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}

func runAdd(args []string) {
	if len(args) == 0 {
		fmt.Fprintf(os.Stderr, "error: forge add requires a command name\n")
		fmt.Fprintf(os.Stderr, "  usage: forge add <name> [--go|--ts|--cs] [--from <template[@ref]>] [--var key=value]\n")
		os.Exit(1)
	}

	name := args[0]
	lang := ""   // will pick default based on available runtimes
	from := ""   // template source
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

	// If using a template, delegate to the template flow.
	if from != "" {
		runAddFromTemplate(name, lang, from, vars)
		return
	}

	// Validate the requested language is available.
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
		// Pick the first available language as the default.
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

	// If no .forge exists in CWD, bootstrap the full setup here.
	if _, err := os.Stat(forgeDir); os.IsNotExist(err) {
		bootstrapForge(cwd, lang)
	}

	// Check if command already exists in discovered command set.
	if existing := findDiscoveredCommand(name); existing {
		fmt.Fprintf(os.Stderr, "error: command '%s' already exists\n", name)
		os.Exit(1)
	}

	scriptDir, scriptName, err := commandScriptDirAndLeaf(cwd, name)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	// Create script directory.
	if err := os.MkdirAll(scriptDir, 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "error creating script directory: %v\n", err)
		os.Exit(1)
	}

	// Generate the script file.
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

// runAddFromTemplate handles `forge add <name> --from <template>`.
// It resolves the template, applies variable substitution, and writes
// the resulting script to the .forge/scripts/ directory.
func runAddFromTemplate(name, lang, from string, vars map[string]string) {
	// Collect registries from discovered manifests for resolution.
	registries := collectRegistries()

	// Resolve the template from the source (built-in → registries → local → git).
	tpl, err := templates.ResolveWithRegistries(from, registries)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	// Pick a language if not specified.
	if lang == "" {
		// Prefer the user's available runtimes, then fall back to what the template offers.
		switch {
		case hasGo() && tpl.HasLanguage("go"):
			lang = "go"
		case hasNode() && tpl.HasLanguage("ts"):
			lang = "ts"
		case hasDotnet() && tpl.HasLanguage("cs"):
			lang = "cs"
		default:
			// Use whatever the template has, even if the runtime might not be installed.
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

	// Validate the runtime is available.
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

	// Apply the template.
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

	// Bootstrap forge if needed.
	if _, err := os.Stat(forgeDir); os.IsNotExist(err) {
		bootstrapForge(cwd, lang)
	}

	// Check if command already exists.
	if existing := findDiscoveredCommand(name); existing {
		fmt.Fprintf(os.Stderr, "error: command '%s' already exists\n", name)
		os.Exit(1)
	}

	scriptDir, scriptName, err := commandScriptDirAndLeaf(cwd, name)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	// Create script directory.
	if err := os.MkdirAll(scriptDir, 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "error creating script directory: %v\n", err)
		os.Exit(1)
	}

	// Write the script file.
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

	// Show applied variables.
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

func runTemplates(args []string) {
	if len(args) > 0 {
		switch args[0] {
		case "publish":
			runTemplatesPublish(args[1:])
			return
		case "help", "--help", "-h":
			fmt.Println(templatesHelpText)
			return
		default:
			fmt.Fprintf(os.Stderr, "error: unknown templates subcommand '%s'\n", args[0])
			fmt.Fprintf(os.Stderr, "  usage: %s\n", templatesUsageLine)
			os.Exit(1)
		}
	}

	registries := collectRegistries()
	allTemplates := templates.ListAllTemplates(registries)

	if len(allTemplates) == 0 {
		fmt.Println("No templates available.")
		return
	}

	fmt.Println("Available templates:")

	// Group by source.
	groups := map[string][]templates.TemplateInfo{}
	var sourceOrder []string
	for _, t := range allTemplates {
		if _, ok := groups[t.Source]; !ok {
			sourceOrder = append(sourceOrder, t.Source)
		}
		groups[t.Source] = append(groups[t.Source], t)
	}

	for _, source := range sourceOrder {
		tpls := groups[source]
		sourceType := ""
		if len(tpls) > 0 {
			sourceType = templateSourceTypeLabel(tpls[0].SourceType)
		}

		fmt.Println()
		if source == "built-in" {
			fmt.Printf("  \033[33m[built-in]\033[0m")
		} else {
			fmt.Printf("  \033[33m[%s]\033[0m", source)
		}
		if sourceType != "" {
			fmt.Printf(" \033[90m(%s)\033[0m", sourceType)
		}
		fmt.Println()

		maxNameLen := 0
		for _, t := range tpls {
			if len(t.Name) > maxNameLen {
				maxNameLen = len(t.Name)
			}
		}

		for _, t := range tpls {
			langs := strings.Join(t.Languages, ", ")
			description := t.Description
			if t.LatestTag != "" {
				description = fmt.Sprintf("%s \033[90m(latest: %s)\033[0m", t.Description, t.LatestTag)
			}
			fmt.Printf("    \033[36m%-*s\033[0m  %s \033[90m(%s)\033[0m\n", maxNameLen, t.Name, description, langs)

			if len(t.Variables) > 0 {
				for _, v := range t.Variables {
					defStr := ""
					if v.Default != "" {
						defStr = fmt.Sprintf(" \033[90m(default: %s)\033[0m", v.Default)
					}
					fmt.Printf("    %-*s    --var %s=<value>%s\n", maxNameLen, "", v.Name, defStr)
				}
			}
		}
	}

	fmt.Println()
	fmt.Println("Usage:")
	fmt.Println("  forge add <name> --from <template[@ref]> [--go|--ts|--cs] [--var key=value]")
	fmt.Println()
	fmt.Println("Pin a registry template version with @tag:")
	fmt.Println("  forge add deploy --from deploy-k8s@v1.2.0")
	fmt.Println()
	fmt.Println("Templates can also be loaded from local directories or git URLs:")
	fmt.Println("  forge add deploy --from ./my-templates/deploy")
	fmt.Println("  forge add deploy --from https://github.com/user/repo#path/to/template")
	fmt.Println()
	fmt.Println("Configure registries in .forge/config.yaml:")
	fmt.Println("  registries:")
	fmt.Println("    - https://github.com/user/forge-templates")
	fmt.Println("    - ./local-templates")
}

// collectRegistries gathers registries from discovered script projects.
// Returns nil if no script projects are found (non-fatal for templates listing).
func collectRegistries() []string {
	cwd, err := os.Getwd()
	if err != nil {
		return nil
	}

	manifests, err := manifest.DiscoverScripts(cwd)
	if err != nil || len(manifests) == 0 {
		return nil
	}

	merged := manifest.Merge(manifests)
	return merged.Registries
}

func findDiscoveredCommand(name string) bool {
	cwd, err := os.Getwd()
	if err != nil {
		return false
	}

	manifests, err := manifest.DiscoverScripts(cwd)
	if err != nil || len(manifests) == 0 {
		return false
	}

	merged := manifest.Merge(manifests)
	_, exists := merged.Commands[name]

	return exists
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
	directive := commandTemplateSchemaDirective(path)

	var b strings.Builder
	if directive != "" {
		b.WriteString(directive)
		b.WriteString("\n")
	}
	b.WriteString("description: ")
	b.WriteString(yamlDoubleQuote(description))
	b.WriteString("\n")
	b.WriteString("script: ")
	b.WriteString(script)
	b.WriteString("\n")

	return os.WriteFile(path, []byte(b.String()), 0o644)
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

func templateSourceTypeLabel(sourceType string) string {
	switch strings.TrimSpace(sourceType) {
	case "built-in":
		return "built-in"
	case "github-git":
		return "github-git"
	case "local-git":
		return "local-git"
	case "folder-index":
		return "folder-index"
	case "folder-scan":
		return "folder-scan"
	default:
		return ""
	}
}

// bootstrapForge creates a .forge/ directory with language support files
// in the given directory. This is a lightweight version of runInit that
// only sets up the requested language, intended for when forge add is run
// from a directory without an existing forge setup.
func bootstrapForge(dir string, lang string) {
	forgeDir := filepath.Join(dir, ".forge")

	// Create .forge/scripts/ directory.
	scriptsDir := filepath.Join(forgeDir, "scripts")
	if err := os.MkdirAll(scriptsDir, 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "error creating .forge/scripts/: %v\n", err)
		os.Exit(1)
	}

	// Create .forge/.gitignore.
	gitignore := "cache/\nforge-schema.json\ntemplate-schema.json\n"
	switch lang {
	case "ts":
		gitignore += "node_modules/\npackage-lock.json\npnpm-lock.yaml\n"
	case "cs":
		gitignore += "bin/\nobj/\n"
	}
	gitignorePath := filepath.Join(forgeDir, ".gitignore")
	if err := os.WriteFile(gitignorePath, []byte(gitignore), 0o644); err != nil {
		fmt.Fprintf(os.Stderr, "error writing .forge/.gitignore: %v\n", err)
		os.Exit(1)
	}

	helpersDir := filepath.Join(forgeDir, "cache", "_helpers")
	if _, err := embedded.ExtractTemplateSchema(forgeDir); err != nil {
		fmt.Fprintf(os.Stderr, "warning: could not extract template schema: %v\n", err)
	}

	// Set up language support files for intellisense.
	switch lang {
	case "go":
		goMod := "module forge-scripts\n\ngo 1.22\n\nrequire github.com/arcmantle/forge v0.0.0\n\nreplace github.com/arcmantle/forge => ./cache/_helpers\n"
		goModPath := filepath.Join(forgeDir, "go.mod")
		if err := os.WriteFile(goModPath, []byte(goMod), 0o644); err != nil {
			fmt.Fprintf(os.Stderr, "error writing go.mod: %v\n", err)
			os.Exit(1)
		}
		if _, err := embedded.ExtractHelpers(helpersDir); err != nil {
			fmt.Fprintf(os.Stderr, "warning: could not extract Go helpers: %v\n", err)
		}

	case "ts":
		if _, err := embedded.ExtractHelpersTS(helpersDir); err != nil {
			fmt.Fprintf(os.Stderr, "warning: could not extract TS helpers: %v\n", err)
		}
		if err := embedded.EnsurePackageJSON(forgeDir, filepath.Join(forgeDir, "cache")); err != nil {
			fmt.Fprintf(os.Stderr, "warning: could not create package.json: %v\n", err)
		}
		if err := embedded.EnsureTSConfig(forgeDir); err != nil {
			fmt.Fprintf(os.Stderr, "warning: could not create tsconfig.json: %v\n", err)
		}
		// Install @types/node.
		fmt.Println("\033[90minstalling @types/node...\033[0m")
		installer := "pnpm"
		installerArgs := []string{"install", "--silent"}
		if !hasPnpm() {
			installer = "npm"
		}
		installCmd := exec.Command(installer, installerArgs...)
		installCmd.Dir = forgeDir
		installCmd.Stdout = os.Stdout
		installCmd.Stderr = os.Stderr
		if err := installCmd.Run(); err != nil {
			fmt.Fprintf(os.Stderr, "warning: could not install @types/node: %v\n", err)
		}

	case "cs":
		if _, err := embedded.ExtractHelpersCS(helpersDir); err != nil {
			fmt.Fprintf(os.Stderr, "warning: could not extract C# helpers: %v\n", err)
		}
		if err := embedded.EnsureCSProj(forgeDir); err != nil {
			fmt.Fprintf(os.Stderr, "warning: could not create ForgeScripts.csproj: %v\n", err)
		}
		if err := embedded.EnsureSLNX(forgeDir); err != nil {
			fmt.Fprintf(os.Stderr, "warning: could not create ForgeScripts.slnx: %v\n", err)
		}
	}

	fmt.Printf("Initialized forge in %s\n", dir)
}

func runSetup(args []string) {
	if len(args) == 0 {
		fmt.Fprintf(os.Stderr, "error: forge setup requires a runtime name\n")
		fmt.Fprintf(os.Stderr, "  usage: forge setup <go|ts|cs>\n")
		os.Exit(1)
	}

	runtime := args[0]
	if runtime != "go" && runtime != "ts" && runtime != "cs" {
		fmt.Fprintf(os.Stderr, "error: unknown runtime '%s' (expected go, ts, or cs)\n", runtime)
		os.Exit(1)
	}

	// Validate the runtime is installed.
	switch runtime {
	case "go":
		if !hasGo() {
			fmt.Fprintf(os.Stderr, "error: Go is not installed\n")
			fmt.Fprintf(os.Stderr, "  install Go from https://go.dev/dl/\n")
			os.Exit(1)
		}
	case "ts":
		if !hasNode() {
			fmt.Fprintf(os.Stderr, "error: Node.js is not installed\n")
			fmt.Fprintf(os.Stderr, "  install Node.js from https://nodejs.org/\n")
			os.Exit(1)
		}
	case "cs":
		if !hasDotnet() {
			fmt.Fprintf(os.Stderr, "error: .NET SDK is not installed\n")
			fmt.Fprintf(os.Stderr, "  install .NET SDK from https://dotnet.microsoft.com/\n")
			os.Exit(1)
		}
	}

	// Determine the target directory for setup.
	// If CWD has its own .forge/ directory, set up support files there.
	// Otherwise, fall back to the closest manifest's project root.
	cwd, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	projectDir := ""
	localForgeDir := filepath.Join(cwd, ".forge")
	if info, err := os.Stat(localForgeDir); err == nil && info.IsDir() {
		// CWD has its own .forge/ directory — set up here.
		projectDir = cwd
	} else {
		// Fall back to the closest discovered scripts project.
		manifests, err := manifest.DiscoverScripts(cwd)
		if err != nil || len(manifests) == 0 {
			fmt.Fprintf(os.Stderr, "error: no .forge/scripts/ or .forge/ found — run 'forge init' first\n")
			os.Exit(1)
		}

		projectDir = manifests[len(manifests)-1].ManifestDir
		if projectDir == "" {
			projectDir = cwd
		}
	}

	forgeDir := filepath.Join(projectDir, ".forge")
	helpersDir := filepath.Join(forgeDir, "cache", "_helpers")
	var created []string

	switch runtime {
	case "go":
		// Create go.mod for intellisense.
		goModPath := filepath.Join(forgeDir, "go.mod")
		if _, err := os.Stat(goModPath); err == nil {
			fmt.Println("Go support is already set up.")
			return
		}

		goMod := "module forge-scripts\n\ngo 1.22\n\nrequire github.com/arcmantle/forge v0.0.0\n\nreplace github.com/arcmantle/forge => ./cache/_helpers\n"
		if err := os.WriteFile(goModPath, []byte(goMod), 0o644); err != nil {
			fmt.Fprintf(os.Stderr, "error writing go.mod: %v\n", err)
			os.Exit(1)
		}
		created = append(created, ".forge/go.mod")

		if _, err := embedded.ExtractHelpers(helpersDir); err != nil {
			fmt.Fprintf(os.Stderr, "warning: could not extract Go helpers: %v\n", err)
		}

	case "ts":
		// Check if already set up.
		pkgPath := filepath.Join(forgeDir, "package.json")
		if _, err := os.Stat(pkgPath); err == nil {
			fmt.Println("TypeScript support is already set up.")
			return
		}

		if _, err := embedded.ExtractHelpersTS(helpersDir); err != nil {
			fmt.Fprintf(os.Stderr, "warning: could not extract TS helpers: %v\n", err)
		}

		if err := embedded.EnsurePackageJSON(forgeDir, filepath.Join(forgeDir, "cache")); err != nil {
			fmt.Fprintf(os.Stderr, "warning: could not create package.json: %v\n", err)
		}
		created = append(created, ".forge/package.json")

		if err := embedded.EnsureTSConfig(forgeDir); err != nil {
			fmt.Fprintf(os.Stderr, "warning: could not create tsconfig.json: %v\n", err)
		}
		created = append(created, ".forge/tsconfig.json")

		// Update .gitignore with node-related entries.
		appendToGitignore(forgeDir, "node_modules/", "package-lock.json", "pnpm-lock.yaml")

		// Install @types/node.
		fmt.Println("\033[90minstalling @types/node...\033[0m")
		installer := "pnpm"
		installerArgs := []string{"install", "--silent"}
		if !hasPnpm() {
			installer = "npm"
		}
		installCmd := exec.Command(installer, installerArgs...)
		installCmd.Dir = forgeDir
		installCmd.Stdout = os.Stdout
		installCmd.Stderr = os.Stderr
		if err := installCmd.Run(); err != nil {
			fmt.Fprintf(os.Stderr, "warning: could not install @types/node: %v\n", err)
		}

	case "cs":
		// Check if already set up.
		csprojPath := filepath.Join(forgeDir, "ForgeScripts.csproj")
		if _, err := os.Stat(csprojPath); err == nil {
			fmt.Println("C# support is already set up.")
			return
		}

		if _, err := embedded.ExtractHelpersCS(helpersDir); err != nil {
			fmt.Fprintf(os.Stderr, "warning: could not extract C# helpers: %v\n", err)
		}

		if err := embedded.EnsureCSProj(forgeDir); err != nil {
			fmt.Fprintf(os.Stderr, "warning: could not create ForgeScripts.csproj: %v\n", err)
		}
		created = append(created, ".forge/ForgeScripts.csproj")

		if err := embedded.EnsureSLNX(forgeDir); err != nil {
			fmt.Fprintf(os.Stderr, "warning: could not create ForgeScripts.slnx: %v\n", err)
		}
		created = append(created, ".forge/ForgeScripts.slnx")

		// Update .gitignore with C# build output entries.
		appendToGitignore(forgeDir, "bin/", "obj/")
	}

	runtimeLabel := map[string]string{"go": "Go", "ts": "TypeScript", "cs": "C#"}[runtime]
	fmt.Printf("Set up %s support:\n", runtimeLabel)
	for _, f := range created {
		fmt.Printf("  created %s\n", f)
	}
}

// appendToGitignore adds entries to .forge/.gitignore if they don't already exist.
func appendToGitignore(forgeDir string, entries ...string) {
	gitignorePath := filepath.Join(forgeDir, ".gitignore")

	existing := ""
	if data, err := os.ReadFile(gitignorePath); err == nil {
		existing = string(data)
	}

	var toAdd []string
	for _, entry := range entries {
		if !strings.Contains(existing, entry) {
			toAdd = append(toAdd, entry)
		}
	}

	if len(toAdd) == 0 {
		return
	}

	f, err := os.OpenFile(gitignorePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer f.Close()

	for _, entry := range toAdd {
		f.WriteString(entry + "\n")
	}
}

func runHelp(args []string) {
	if len(args) == 0 {
		printUsage()
		return
	}

	if args[0] == "auth" {
		if len(args) >= 2 && args[1] == "github" {
			fmt.Println(authGitHubHelpText)
			return
		}

		fmt.Println(authHelpText)
		return
	}

	if args[0] == "templates" {
		fmt.Println(templatesHelpText)
		return
	}

	m := getManifest()
	name, _ := resolveCommand(args, m.Commands)

	cmd, ok := m.Commands[name]
	if !ok {
		// Check if this is a group prefix.
		children := commandsWithPrefix(name, m.Commands)
		if len(children) > 0 {
			fmt.Printf("%s — command group\n\n", name)
			fmt.Println("Subcommands:")
			for _, child := range children {
				suffix := child[len(name)+1:]
				desc := m.Commands[child].Description
				if desc != "" {
					fmt.Printf("  \033[36m%s\033[0m  %s\n", suffix, desc)
				} else {
					fmt.Printf("  \033[36m%s\033[0m\n", suffix)
				}
			}
			return
		}

		fmt.Fprintf(os.Stderr, "error: unknown command '%s'\n", name)
		os.Exit(1)
	}

	// Composite commands — show the run steps.
	if len(cmd.Run) > 0 {
		fmt.Printf("%s — %s\n\n", name, cmd.Description)
		fmt.Println("Composite command:")
		for _, step := range cmd.Run {
			if len(step.Parallel) > 0 {
				fmt.Printf("  parallel: [%s]\n", strings.Join(step.Parallel, ", "))
			} else if len(step.Args) > 0 {
				fmt.Printf("  %s %s\n", step.Command, strings.Join(step.Args, " "))
			} else {
				fmt.Printf("  %s\n", step.Command)
			}
		}

		return
	}

	// Script commands — try to get metadata via --forge-meta.
	meta, err := runner.Meta(cmd, m)
	if err != nil || meta == nil {
		// Script doesn't support introspection — show basic info.
		fmt.Printf("%s — %s\n", name, cmd.Description)
		if cmd.Script != "" {
			fmt.Printf("  script: %s\n", cmd.Script)
		}

		return
	}

	// Parse and display the metadata.
	var parsed struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Args        []struct {
			Name        string `json:"name"`
			Type        string `json:"type"`
			Description string `json:"description"`
			Positional  bool   `json:"positional"`
			Required    bool   `json:"required"`
			Default     string `json:"default"`
		} `json:"args"`
	}

	if err := json.Unmarshal(meta, &parsed); err != nil {
		// Invalid JSON — fall back to basic info.
		fmt.Printf("%s — %s\n", name, cmd.Description)
		return
	}

	// Build the help display.
	var positionals, flags []struct {
		Name        string
		Type        string
		Description string
		Required    bool
		Default     string
	}

	for _, a := range parsed.Args {
		entry := struct {
			Name        string
			Type        string
			Description string
			Required    bool
			Default     string
		}{a.Name, a.Type, a.Description, a.Required, a.Default}

		if a.Positional {
			positionals = append(positionals, entry)
		} else {
			flags = append(flags, entry)
		}
	}

	// Usage line.
	usage := "forge " + name
	for _, p := range positionals {
		usage += " <" + p.Name + ">"
	}
	if len(flags) > 0 {
		usage += " [flags]"
	}

	desc := parsed.Description
	if desc == "" {
		desc = cmd.Description
	}

	fmt.Printf("%s — %s\n\n", name, desc)
	fmt.Printf("Usage:\n  %s\n", usage)

	if len(positionals) > 0 {
		fmt.Println("\nArgs:")
		maxLen := 0
		for _, p := range positionals {
			if len(p.Name) > maxLen {
				maxLen = len(p.Name)
			}
		}
		for _, p := range positionals {
			fmt.Printf("  %-*s    %s\n", maxLen, p.Name, p.Description)
		}
	}

	if len(flags) > 0 {
		fmt.Println("\nFlags:")
		maxLen := 0
		type flagEntry struct {
			display string
			desc    string
		}
		var entries []flagEntry
		for _, f := range flags {
			display := "--" + f.Name
			if f.Type == "string" {
				display += " <value>"
			}
			if len(display) > maxLen {
				maxLen = len(display)
			}
			desc := f.Description
			if f.Default != "" {
				desc += fmt.Sprintf(" (default: %s)", f.Default)
			}
			entries = append(entries, flagEntry{display, desc})
		}
		for _, e := range entries {
			fmt.Printf("  %-*s    %s\n", maxLen, e.display, e.desc)
		}
	}
}

func runAuth(args []string) {
	if len(args) == 0 {
		fmt.Fprintf(os.Stderr, "error: forge auth requires a provider\n")
		fmt.Fprintf(os.Stderr, "  usage: %s\n", authGitHubUsageLine)
		os.Exit(1)
	}

	provider := strings.TrimSpace(args[0])
	if provider != "github" {
		fmt.Fprintf(os.Stderr, "error: unsupported auth provider '%s'\n", provider)
		fmt.Fprintf(os.Stderr, "  supported: github\n")
		os.Exit(1)
	}

	tokenArg := ""
	clearToken := false
	showStatus := false
	for i := 1; i < len(args); i++ {
		arg := args[i]
		switch {
		case arg == "--clear":
			clearToken = true
		case arg == "--status":
			showStatus = true
		case arg == "--token":
			if i+1 >= len(args) {
				fmt.Fprintf(os.Stderr, "error: --token requires a value\n")
				os.Exit(1)
			}
			i++
			tokenArg = args[i]
		case strings.HasPrefix(arg, "--token="):
			tokenArg = strings.TrimPrefix(arg, "--token=")
		default:
			fmt.Fprintf(os.Stderr, "error: unknown flag '%s'\n", arg)
			fmt.Fprintf(os.Stderr, "  usage: %s\n", authGitHubUsageLine)
			os.Exit(1)
		}
	}

	if clearToken && tokenArg != "" {
		fmt.Fprintf(os.Stderr, "error: --clear cannot be combined with --token\n")
		os.Exit(1)
	}

	if showStatus && (clearToken || tokenArg != "") {
		fmt.Fprintf(os.Stderr, "error: --status cannot be combined with --clear or --token\n")
		os.Exit(1)
	}

	if showStatus {
		envConfigured, configConfigured, configPath, err := templates.GitHubTokenStatus()
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			os.Exit(1)
		}

		fmt.Println("GitHub auth status:")
		fmt.Printf("  env (GITHUB_TOKEN): %s\n", boolLabel(envConfigured))
		fmt.Printf("  config token:        %s\n", boolLabel(configConfigured))
		fmt.Printf("  config path:         %s\n", configPath)
		return
	}

	if clearToken {
		if err := templates.ClearGitHubToken(); err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("GitHub token cleared.")
		return
	}

	if tokenArg != "" {
		if err := templates.SaveGitHubToken(tokenArg); err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("GitHub token saved.")
		return
	}

	if _, err := templates.PromptAndSaveGitHubToken(); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}

func boolLabel(v bool) string {
	if v {
		return "configured"
	}

	return "not configured"
}

func runInit() {
	cwd, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	forgeDir := filepath.Join(cwd, ".forge")
	scriptsDir := filepath.Join(forgeDir, "scripts")

	// Check if already initialized.
	if _, err := os.Stat(forgeDir); err == nil {
		fmt.Println(".forge already exists in this directory.")
		return
	}

	// Detect available runtimes.
	goAvailable := hasGo()
	nodeAvailable := hasNode()
	dotnetAvailable := hasDotnet()

	if !goAvailable && !nodeAvailable && !dotnetAvailable {
		fmt.Fprintf(os.Stderr, "error: no supported runtime found\n")
		fmt.Fprintf(os.Stderr, "  install at least one of: Go, Node.js, or .NET SDK\n")
		os.Exit(1)
	}

	// Pick the best language for the hello example.
	helloLang := ""
	helloExt := ""
	switch {
	case goAvailable:
		helloLang = "go"
		helloExt = ".go"
	case nodeAvailable:
		helloLang = "ts"
		helloExt = ".ts"
	case dotnetAvailable:
		helloLang = "cs"
		helloExt = ".cs"
	}

	// Create .forge/scripts/hello/ directory.
	helloDir := filepath.Join(scriptsDir, "hello")
	if err := os.MkdirAll(helloDir, 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "error creating .forge/scripts/hello/: %v\n", err)
		os.Exit(1)
	}

	// Create .forge/.gitignore to exclude generated artifacts.
	gitignore := "cache/\nforge-schema.json\ntemplate-schema.json\n"
	if nodeAvailable {
		gitignore += "node_modules/\npackage-lock.json\npnpm-lock.yaml\n"
	}
	if dotnetAvailable {
		gitignore += "bin/\nobj/\n"
	}
	gitignorePath := filepath.Join(forgeDir, ".gitignore")
	if err := os.WriteFile(gitignorePath, []byte(gitignore), 0o644); err != nil {
		fmt.Fprintf(os.Stderr, "error writing .forge/.gitignore: %v\n", err)
		os.Exit(1)
	}

	var created []string
	helpersDir := filepath.Join(forgeDir, "cache", "_helpers")
	if _, err := embedded.ExtractTemplateSchema(forgeDir); err != nil {
		fmt.Fprintf(os.Stderr, "warning: could not extract template schema: %v\n", err)
	}

	// --- Go scaffolding ---
	if goAvailable {
		goMod := "module forge-scripts\n\ngo 1.22\n\nrequire github.com/arcmantle/forge v0.0.0\n\nreplace github.com/arcmantle/forge => ./cache/_helpers\n"
		goModPath := filepath.Join(forgeDir, "go.mod")
		if err := os.WriteFile(goModPath, []byte(goMod), 0o644); err != nil {
			fmt.Fprintf(os.Stderr, "error writing .forge/go.mod: %v\n", err)
			os.Exit(1)
		}
		created = append(created, ".forge/go.mod")

		if _, err := embedded.ExtractHelpers(helpersDir); err != nil {
			fmt.Fprintf(os.Stderr, "warning: could not extract Go helpers: %v\n", err)
		}
	}

	// --- TypeScript scaffolding ---
	if nodeAvailable {
		if _, err := embedded.ExtractHelpersTS(helpersDir); err != nil {
			fmt.Fprintf(os.Stderr, "warning: could not extract TS helpers: %v\n", err)
		}

		if err := embedded.EnsurePackageJSON(forgeDir, filepath.Join(forgeDir, "cache")); err != nil {
			fmt.Fprintf(os.Stderr, "warning: could not create package.json: %v\n", err)
		}
		created = append(created, ".forge/package.json")

		if err := embedded.EnsureTSConfig(forgeDir); err != nil {
			fmt.Fprintf(os.Stderr, "warning: could not create tsconfig.json: %v\n", err)
		}
		created = append(created, ".forge/tsconfig.json")

		// Install @types/node.
		fmt.Println("\033[90minstalling @types/node...\033[0m")
		installer := "pnpm"
		installerArgs := []string{"install", "--silent"}
		if !hasPnpm() {
			installer = "npm"
		}
		installCmd := exec.Command(installer, installerArgs...)
		installCmd.Dir = forgeDir
		installCmd.Stdout = os.Stdout
		installCmd.Stderr = os.Stderr
		if err := installCmd.Run(); err != nil {
			fmt.Fprintf(os.Stderr, "warning: could not install @types/node: %v\n", err)
		}
	}

	// --- C# scaffolding ---
	if dotnetAvailable {
		if _, err := embedded.ExtractHelpersCS(helpersDir); err != nil {
			fmt.Fprintf(os.Stderr, "warning: could not extract C# helpers: %v\n", err)
		}

		if err := embedded.EnsureCSProj(forgeDir); err != nil {
			fmt.Fprintf(os.Stderr, "warning: could not create ForgeScripts.csproj: %v\n", err)
		}
		created = append(created, ".forge/ForgeScripts.csproj")

		if err := embedded.EnsureSLNX(forgeDir); err != nil {
			fmt.Fprintf(os.Stderr, "warning: could not create ForgeScripts.slnx: %v\n", err)
		}
		created = append(created, ".forge/ForgeScripts.slnx")
	}

	// --- Hello example script ---
	var helloScript string
	switch helloLang {
	case "go":
		helloScript = `package main

import "github.com/arcmantle/forge/helpers"

func main() {
	helpers.Success("Hello from forge!")
}
`
	case "ts":
		helloScript = `import { success } from '#helpers';

success('Hello from forge!');
`
	case "cs":
		helloScript = `using Forge.Helpers;

Log.Success("Hello from forge!");
`
	}

	helloFile := filepath.Join(helloDir, "hello"+helloExt)
	if err := os.WriteFile(helloFile, []byte(helloScript), 0o644); err != nil {
		fmt.Fprintf(os.Stderr, "error writing hello script: %v\n", err)
		os.Exit(1)
	}

	// Create .forge/scripts/hello/template.yaml.
	helloTemplatePath := filepath.Join(helloDir, manifest.CommandTemplateFile)
	if err := writeCommandTemplate(helloTemplatePath, "A starting point for your first forge script", "hello"+helloExt); err != nil {
		fmt.Fprintf(os.Stderr, "error writing %s: %v\n", manifest.CommandTemplateFile, err)
		os.Exit(1)
	}
	helloExamplePath := filepath.Join(helloDir, "example.md")
	if err := writeCommandExample(helloExamplePath, "hello", "A starting point for your first forge script", false); err != nil {
		fmt.Fprintf(os.Stderr, "error writing example.md: %v\n", err)
		os.Exit(1)
	}

	// Print summary.
	fmt.Println("Initialized forge:")
	for _, f := range created {
		fmt.Printf("  created %s\n", f)
	}
	fmt.Println("  created .forge/.gitignore")
	fmt.Println("  created .forge/scripts/hello/template.yaml")
	fmt.Println("  created .forge/scripts/hello/example.md")
	fmt.Printf("  created .forge/scripts/hello/hello%s\n", helloExt)

	// Show which runtimes were detected.
	fmt.Println()
	fmt.Print("  runtimes: ")
	var runtimes []string
	if goAvailable {
		runtimes = append(runtimes, "Go")
	}
	if nodeAvailable {
		runtimes = append(runtimes, "Node.js")
	}
	if dotnetAvailable {
		runtimes = append(runtimes, ".NET")
	}
	fmt.Printf("\033[36m%s\033[0m\n", strings.Join(runtimes, ", "))

	fmt.Println()
	fmt.Println("Run '\033[36mforge hello\033[0m' to try it out.")
}
