package commands

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/arcmantle/forge/internal/embedded"
	"github.com/arcmantle/forge/internal/manifest"
)

func bootstrapForge(dir string, lang string) {
	forgeDir := filepath.Join(dir, ".forge")

	scriptsDir := filepath.Join(forgeDir, "scripts")
	if err := os.MkdirAll(scriptsDir, 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "error creating .forge/scripts/: %v\n", err)
		os.Exit(1)
	}

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

	cwd, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	projectDir := ""
	localForgeDir := filepath.Join(cwd, ".forge")
	if info, err := os.Stat(localForgeDir); err == nil && info.IsDir() {
		projectDir = cwd
	} else {
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

		appendToGitignore(forgeDir, "node_modules/", "package-lock.json", "pnpm-lock.yaml")

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

		appendToGitignore(forgeDir, "bin/", "obj/")
	}

	runtimeLabel := map[string]string{"go": "Go", "ts": "TypeScript", "cs": "C#"}[runtime]
	fmt.Printf("Set up %s support:\n", runtimeLabel)
	for _, f := range created {
		fmt.Printf("  created %s\n", f)
	}
}

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
