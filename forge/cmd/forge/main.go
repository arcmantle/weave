package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"

	"github.com/arcmantle/forge/internal/embedded"
	"github.com/arcmantle/forge/internal/manifest"
	"github.com/arcmantle/forge/internal/runner"
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
	case "init":
		runInit()
	case "add":
		runAdd(args)
	case "setup":
		runSetup(args)
	case "help":
		runHelp(args)
	default:
		runCommand(os.Args[1:])
	}
}

func printUsage() {
	fmt.Println(`forge — universal repo script runner

Usage:
  forge <command> [args...]
  forge --list              List available commands
  forge --help              Show this help
  forge --version           Show version
  forge init                Scaffold forge.yaml and .forge/ directory
  forge add <name> [--lang] Add a new script (go, ts, cs — default: go)
  forge setup <runtime>     Add scaffolding for a runtime (go, ts, cs)
  forge help <command>      Show detailed help for a command

Commands are defined in forge.yaml and executed from .forge/ scripts.
Manifests are discovered by walking up from the current directory,
allowing hierarchical command definitions.`)
}

func getManifest() *manifest.Manifest {
	cwd, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: could not get working directory: %v\n", err)
		os.Exit(1)
	}

	manifests, err := manifest.Discover(cwd)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	if len(manifests) == 0 {
		fmt.Fprintf(os.Stderr, "error: no forge.yaml found in current or parent directories\n")
		fmt.Fprintf(os.Stderr, "  run 'forge init' to create one\n")
		os.Exit(1)
	}

	return manifest.Merge(manifests)
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
	m := getManifest()

	if len(m.Commands) == 0 {
		fmt.Println("No commands defined.")
		return
	}

	// Sort command names for stable output.
	names := make([]string, 0, len(m.Commands))
	for name := range m.Commands {
		names = append(names, name)
	}
	sort.Strings(names)

	// Separate top-level commands from nested ones.
	// A top-level command either has no colon or is a root-level group member.
	type group struct {
		children []string // full command names
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

	// Collect the display names: top-level commands + groups that aren't
	// already a top-level command.
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

	// Find max display name length for alignment.
	maxLen := 0
	for _, name := range displayOrder {
		if len(name) > maxLen {
			maxLen = len(name)
		}
		if g, ok := groups[name]; ok {
			for _, child := range g.children {
				// Display name is the part after the last colon, indented.
				suffix := child[strings.LastIndex(child, ":")+1:]
				padded := len(suffix) + 2 // 2 extra indent
				if padded > maxLen {
					maxLen = padded
				}
			}
		}
	}

	fmt.Println("Available commands:")
	fmt.Println()

	for _, name := range displayOrder {
		// Print the command itself (if it exists as a real command).
		if cmd, ok := m.Commands[name]; ok {
			desc := cmd.Description
			if desc == "" {
				desc = "\033[90m(no description)\033[0m"
			}
			fmt.Printf("  \033[36m%-*s\033[0m  %s\n", maxLen, name, desc)
		} else {
			// Group header with no backing command.
			fmt.Printf("  \033[36m%s\033[0m\n", name)
		}

		// Print nested children.
		if g, ok := groups[name]; ok {
			for _, child := range g.children {
				suffix := child[strings.LastIndex(child, ":")+1:]
				desc := m.Commands[child].Description
				if desc == "" {
					desc = "\033[90m(no description)\033[0m"
				}
				fmt.Printf("    \033[36m%-*s\033[0m  %s\n", maxLen-2, suffix, desc)
			}
		}
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
		fmt.Fprintf(os.Stderr, "  usage: forge add <name> [--go|--ts|--cs]\n")
		os.Exit(1)
	}

	name := args[0]
	lang := "" // will pick default based on available runtimes

	for _, arg := range args[1:] {
		switch arg {
		case "--go":
			lang = "go"
		case "--ts":
			lang = "ts"
		case "--cs":
			lang = "cs"
		default:
			fmt.Fprintf(os.Stderr, "error: unknown flag '%s' (expected --go, --ts, or --cs)\n", arg)
			os.Exit(1)
		}
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

	// Find the manifest.
	cwd, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	manifests, err := manifest.Discover(cwd)
	if err != nil || len(manifests) == 0 {
		fmt.Fprintf(os.Stderr, "error: no forge.yaml found — run 'forge init' first\n")
		os.Exit(1)
	}

	// Use the closest manifest.
	m := manifests[0]
	manifestDir := ""
	for n, cmd := range m.Commands {
		_ = n
		manifestDir = cmd.ManifestDir
		break
	}

	// Fallback: derive from the manifest file discovery.
	if manifestDir == "" {
		manifestDir = cwd
	}

	// Discover manifestPath by walking up.
	manifestPath := filepath.Join(manifestDir, manifest.ManifestFile)
	if _, err := os.Stat(manifestPath); os.IsNotExist(err) {
		// Try CWD.
		manifestPath = filepath.Join(cwd, manifest.ManifestFile)
	}

	forgeDir := filepath.Join(manifestDir, ".forge")

	// For colon-delimited names, use a hyphenated form for directories/files.
	scriptName := strings.ReplaceAll(name, ":", "-")
	scriptDir := filepath.Join(forgeDir, "scripts", scriptName)

	// Check if command already exists.
	if _, ok := m.Commands[name]; ok {
		fmt.Fprintf(os.Stderr, "error: command '%s' already exists\n", name)
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

	// Append the command to forge.yaml.
	f, err := os.OpenFile(manifestPath, os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error opening forge.yaml: %v\n", err)
		os.Exit(1)
	}
	defer f.Close()

	relScript := filepath.ToSlash(filepath.Join(".forge", "scripts", scriptName, scriptName+ext))
	entry := fmt.Sprintf("\n  %s:\n    description: \"\"\n    script: %s\n", name, relScript)
	if _, err := f.WriteString(entry); err != nil {
		fmt.Fprintf(os.Stderr, "error writing to forge.yaml: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Added command '\033[36m%s\033[0m' (%s)\n", name, lang)
	fmt.Printf("  script: %s\n", relScript)
	fmt.Printf("  manifest: %s\n", manifestPath)
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

	// Find the forge project root.
	cwd, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	manifests, err := manifest.Discover(cwd)
	if err != nil || len(manifests) == 0 {
		fmt.Fprintf(os.Stderr, "error: no forge.yaml found — run 'forge init' first\n")
		os.Exit(1)
	}

	// Derive the project root from the closest manifest.
	projectDir := ""
	for _, cmd := range manifests[0].Commands {
		projectDir = cmd.ManifestDir
		break
	}
	if projectDir == "" {
		projectDir = cwd
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

func runInit() {
	cwd, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	manifestPath := filepath.Join(cwd, manifest.ManifestFile)
	forgeDir := filepath.Join(cwd, ".forge")
	scriptsDir := filepath.Join(forgeDir, "scripts")

	// Check if already initialized.
	if _, err := os.Stat(manifestPath); err == nil {
		fmt.Println("forge.yaml already exists in this directory.")
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
	gitignore := "cache/\nforge-schema.json\n"
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

	// Create forge.yaml.
	scriptPath := filepath.ToSlash(filepath.Join(".forge", "scripts", "hello", "hello"+helloExt))
	forgeYaml := fmt.Sprintf(`# yaml-language-server: $schema=.forge/forge-schema.json
commands:
  hello:
    description: "A starting point for your first forge script"
    script: %s
`, scriptPath)
	if err := os.WriteFile(manifestPath, []byte(forgeYaml), 0o644); err != nil {
		fmt.Fprintf(os.Stderr, "error writing forge.yaml: %v\n", err)
		os.Exit(1)
	}

	// Extract the JSON schema for forge.yaml intellisense.
	if _, err := embedded.ExtractSchema(forgeDir); err != nil {
		fmt.Fprintf(os.Stderr, "warning: could not extract schema: %v\n", err)
	}

	// Print summary.
	fmt.Println("Initialized forge:")
	fmt.Println("  created forge.yaml")
	for _, f := range created {
		fmt.Printf("  created %s\n", f)
	}
	fmt.Println("  created .forge/.gitignore")
	fmt.Println("  created .forge/forge-schema.json")
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
