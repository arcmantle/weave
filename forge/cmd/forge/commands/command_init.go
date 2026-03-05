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

func runInit() {
	cwd, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	forgeDir := filepath.Join(cwd, ".forge")
	scriptsDir := filepath.Join(forgeDir, "scripts")

	if _, err := os.Stat(forgeDir); err == nil {
		fmt.Println(".forge already exists in this directory.")
		return
	}

	goAvailable := hasGo()
	nodeAvailable := hasNode()
	dotnetAvailable := hasDotnet()

	if !goAvailable && !nodeAvailable && !dotnetAvailable {
		fmt.Fprintf(os.Stderr, "error: no supported runtime found\n")
		fmt.Fprintf(os.Stderr, "  install at least one of: Go, Node.js, or .NET SDK\n")
		os.Exit(1)
	}

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

	helloDir := filepath.Join(scriptsDir, "hello")
	if err := os.MkdirAll(helloDir, 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "error creating .forge/scripts/hello/: %v\n", err)
		os.Exit(1)
	}

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

	fmt.Println("Initialized forge:")
	for _, f := range created {
		fmt.Printf("  created %s\n", f)
	}
	fmt.Println("  created .forge/.gitignore")
	fmt.Println("  created .forge/scripts/hello/template.yaml")
	fmt.Println("  created .forge/scripts/hello/example.md")
	fmt.Printf("  created .forge/scripts/hello/hello%s\n", helloExt)

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
