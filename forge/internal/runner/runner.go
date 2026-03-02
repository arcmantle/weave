package runner

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/arcmantle/forge/internal/embedded"
	"github.com/arcmantle/forge/internal/manifest"
)

const forgeModule = "github.com/arcmantle/forge"

// Run executes a command's script with the given arguments.
func Run(cmd manifest.Command, m *manifest.Manifest, args []string) error {
	return runWithCycleCheck(cmd, m, args, nil)
}

// runWithCycleCheck is the internal entry point that threads a visited set
// through composite command resolution to detect cycles.
func runWithCycleCheck(cmd manifest.Command, m *manifest.Manifest, args []string, visited map[string]bool) error {
	// Composite command — run steps sequentially/parallel.
	if len(cmd.Run) > 0 {
		return runComposite(cmd, m, args, visited)
	}

	// Script-backed command.
	if cmd.Script == "" {
		return fmt.Errorf("command has neither 'script' nor 'run' defined")
	}

	scriptPath := resolveScriptPath(cmd)

	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		return fmt.Errorf("script not found: %s", scriptPath)
	}

	ext := strings.ToLower(filepath.Ext(scriptPath))
	switch ext {
	case ".go":
		return runGo(scriptPath, cmd.ManifestDir, args)
	case ".ts":
		return runTs(scriptPath, cmd.ManifestDir, args)
	case ".cs":
		return runCs(scriptPath, cmd.ManifestDir, args)
	default:
		return fmt.Errorf("unsupported script type: %s", ext)
	}
}

// runComposite executes a composite command's run steps.
// Steps execute sequentially. A step is either a single command or
// a set of commands to run in parallel.
//
// Argument forwarding:
//   - Steps with explicit args use those (no forwarding).
//   - Steps without args receive the composite command's CLI args.
//   - Parallel entries with inline args (e.g. "lint --fix") use those;
//     entries without inline args receive the composite's CLI args.
func runComposite(cmd manifest.Command, m *manifest.Manifest, args []string, visited map[string]bool) error {
	for _, step := range cmd.Run {
		if len(step.Parallel) > 0 {
			if err := runParallel(step.Parallel, m, args, visited); err != nil {
				return err
			}
		} else {
			// Use step-specific args if defined, otherwise forward composite args.
			stepArgs := args
			if len(step.Args) > 0 {
				stepArgs = step.Args
			}

			if err := runRef(step.Command, m, stepArgs, visited); err != nil {
				return err
			}
		}
	}

	return nil
}

// runRef resolves and executes a referenced command by name.
// Detects cycles by tracking visited command names through the call chain.
func runRef(name string, m *manifest.Manifest, args []string, visited map[string]bool) error {
	if visited == nil {
		visited = make(map[string]bool)
	}

	if visited[name] {
		// Build the cycle path for a clear error message.
		var chain []string
		for v := range visited {
			chain = append(chain, v)
		}
		chain = append(chain, name)
		return fmt.Errorf("cycle detected: %s", strings.Join(chain, " → "))
	}

	ref, ok := m.Commands[name]
	if !ok {
		return fmt.Errorf("referenced command '%s' not found", name)
	}

	// Clone the visited set so parallel branches don't cross-contaminate.
	next := make(map[string]bool, len(visited)+1)
	for k, v := range visited {
		next[k] = v
	}
	next[name] = true

	return runWithCycleCheck(ref, m, args, next)
}

// runParallel runs multiple commands concurrently, collecting all errors.
// Each entry may contain inline args (e.g. "lint --fix") — if present,
// those args are used instead of the forwarded composite args.
func runParallel(entries []string, m *manifest.Manifest, args []string, visited map[string]bool) error {
	var wg sync.WaitGroup
	errs := make([]error, len(entries))

	for i, entry := range entries {
		wg.Add(1)

		// Split entry into command name + optional inline args.
		parts := strings.Fields(entry)
		cmdName := parts[0]
		cmdArgs := args // forward composite args by default
		if len(parts) > 1 {
			cmdArgs = parts[1:] // use inline args instead
		}

		go func(idx int, name string, a []string) {
			defer wg.Done()
			errs[idx] = runRef(name, m, a, visited)
		}(i, cmdName, cmdArgs)
	}

	wg.Wait()

	var failed []string
	for i, err := range errs {
		if err != nil {
			name := strings.Fields(entries[i])[0]
			failed = append(failed, fmt.Sprintf("%s: %v", name, err))
		}
	}

	if len(failed) > 0 {
		return fmt.Errorf("parallel failures:\n  %s", strings.Join(failed, "\n  "))
	}

	return nil
}

func resolveScriptPath(cmd manifest.Command) string {
	if filepath.IsAbs(cmd.Script) {
		return cmd.Script
	}

	return filepath.Join(cmd.ManifestDir, cmd.Script)
}

// runGo compiles and caches a Go script, then runs the cached binary.
//
// Directory structure:
//
//	.forge/
//	  go.mod              ← checked in, has replace directive for intellisense
//	  scripts/            ← user-written scripts (package main with func main)
//	  cache/              ← gitignored build artifacts
//	    _helpers/         ← extracted helpers module
//	    <script>/         ← per-script build directory
//	      script.go       ← copied script
//	      go.mod          ← generated module file
//	      <binary>        ← compiled binary
func runGo(scriptPath string, manifestDir string, args []string) error {
	bin, err := compileGo(scriptPath, manifestDir)
	if err != nil {
		return err
	}

	return execBinary(bin, manifestDir, args)
}

// compileGo compiles a Go script if needed and returns the cached binary path.
func compileGo(scriptPath string, manifestDir string) (string, error) {
	baseName := strings.TrimSuffix(filepath.Base(scriptPath), ".go")

	// Locate the .forge/ directory relative to the manifest.
	forgeDir := filepath.Join(manifestDir, ".forge")
	forgeCache := filepath.Join(forgeDir, "cache")

	// Each script gets its own isolated build directory.
	buildDir := filepath.Join(forgeCache, baseName)
	if err := os.MkdirAll(buildDir, 0o755); err != nil {
		return "", fmt.Errorf("creating build dir: %w", err)
	}

	// Extract the embedded helpers so both intellisense and compilation work.
	helpersDir := filepath.Join(forgeCache, "_helpers")
	if _, err := embedded.ExtractHelpers(helpersDir); err != nil {
		return "", fmt.Errorf("extracting helpers: %w", err)
	}

	// Keep the schema up-to-date alongside helpers.
	if _, err := embedded.ExtractSchema(forgeDir); err != nil {
		fmt.Fprintf(os.Stderr, "warning: could not extract schema: %v\n", err)
	}
	if _, err := embedded.ExtractTemplateSchema(forgeDir); err != nil {
		fmt.Fprintf(os.Stderr, "warning: could not extract template schema: %v\n", err)
	}

	// Compute content hash of the script to decide if recompilation is needed.
	content, err := os.ReadFile(scriptPath)
	if err != nil {
		return "", fmt.Errorf("reading script: %w", err)
	}

	hash := sha256.Sum256(content)
	hashStr := hex.EncodeToString(hash[:8])

	binaryName := baseName
	if runtime.GOOS == "windows" {
		binaryName += ".exe"
	}

	cachedBinary := filepath.Join(buildDir, binaryName)
	hashFile := filepath.Join(buildDir, baseName+".hash")

	// Check if we need to recompile.
	needsBuild := true
	if existingHash, err := os.ReadFile(hashFile); err == nil {
		if string(existingHash) == hashStr {
			if _, err := os.Stat(cachedBinary); err == nil {
				needsBuild = false
			}
		}
	}

	if needsBuild {
		fmt.Printf("\033[90mcompiling %s...\033[0m\n", baseName)

		// Copy the script into the build directory.
		scriptDest := filepath.Join(buildDir, "script.go")
		if err := os.WriteFile(scriptDest, content, 0o644); err != nil {
			return "", fmt.Errorf("copying script: %w", err)
		}

		// Remove legacy main.go wrapper if present from older forge versions.
		oldWrapper := filepath.Join(buildDir, "main.go")
		os.Remove(oldWrapper)

		// Generate go.mod with replace directive pointing to the extracted helpers.
		absHelpersDir, err := filepath.Abs(helpersDir)
		if err != nil {
			return "", fmt.Errorf("resolving helpers path: %w", err)
		}

		goMod := fmt.Sprintf("module forge-script/%s\n\ngo 1.22\n\nrequire %s v0.0.0\n\nreplace %s => %s\n",
			baseName, forgeModule, forgeModule, absHelpersDir,
		)
		goModPath := filepath.Join(buildDir, "go.mod")
		if err := os.WriteFile(goModPath, []byte(goMod), 0o644); err != nil {
			return "", fmt.Errorf("writing go.mod: %w", err)
		}

		// Compile.
		buildCmd := exec.Command("go", "build", "-o", cachedBinary, ".")
		buildCmd.Dir = buildDir
		buildCmd.Stdout = os.Stdout
		buildCmd.Stderr = os.Stderr

		if err := buildCmd.Run(); err != nil {
			return "", fmt.Errorf("compiling script: %w", err)
		}

		// Store the hash so we can skip recompilation next time.
		if err := os.WriteFile(hashFile, []byte(hashStr), 0o644); err != nil {
			return "", fmt.Errorf("writing hash file: %w", err)
		}
	}

	return cachedBinary, nil
}

// runTs runs a TypeScript script directly via Node's native TS support.
// No compilation step needed — Node 22+ strips types natively.
func runTs(scriptPath string, manifestDir string, args []string) error {
absScript, err := PrepareTs(scriptPath, manifestDir)
	if err != nil {
		return err
	}

	nodeArgs := []string{absScript}
	nodeArgs = append(nodeArgs, args...)

	runCmd := exec.Command("node", nodeArgs...)
	runCmd.Stdout = os.Stdout
	runCmd.Stderr = os.Stderr
	runCmd.Stdin = os.Stdin

	return runCmd.Run()
}

// PrepareTs extracts TS helpers and returns the absolute script path.
func PrepareTs(scriptPath string, manifestDir string) (string, error) {
	forgeDir := filepath.Join(manifestDir, ".forge")
	forgeCache := filepath.Join(forgeDir, "cache")

	// Extract TS helpers.
	helpersDir := filepath.Join(forgeCache, "_helpers")
	if _, err := embedded.ExtractHelpersTS(helpersDir); err != nil {
		return "", fmt.Errorf("extracting ts helpers: %w", err)
	}

	// Ensure package.json exists for subpath imports.
	if err := embedded.EnsurePackageJSON(forgeDir, forgeCache); err != nil {
		return "", fmt.Errorf("writing package.json: %w", err)
	}

	// Keep the schema up-to-date.
	if _, err := embedded.ExtractSchema(forgeDir); err != nil {
		fmt.Fprintf(os.Stderr, "warning: could not extract schema: %v\n", err)
	}
	if _, err := embedded.ExtractTemplateSchema(forgeDir); err != nil {
		fmt.Fprintf(os.Stderr, "warning: could not extract template schema: %v\n", err)
	}

	// Resolve the absolute script path for node.
	absScript, err := filepath.Abs(scriptPath)
	if err != nil {
		return "", fmt.Errorf("resolving script path: %w", err)
	}

	return absScript, nil
}

// runCs compiles and caches a C# script, then runs the cached executable.
//
// Uses top-level statements (C# 9+) so scripts need no class/Main boilerplate.
// The generated .csproj includes the script file and a project reference to the
// extracted ForgeHelpers library.
//
// Directory structure:
//
//	.forge/
//	  scripts/            ← user-written scripts
//	  cache/              ← gitignored build artifacts
//	    _helpers/
//	      helpers_cs/     ← extracted helpers project
//	    <script>/         ← per-script build directory
//	      script.cs       ← copied script
//	      ForgeScript.csproj ← generated project file
//	      bin/            ← build output
func runCs(scriptPath string, manifestDir string, args []string) error {
	bin, err := compileCs(scriptPath, manifestDir)
	if err != nil {
		return err
	}

	return execBinary(bin, manifestDir, args)
}

// compileCs compiles a C# script if needed and returns the cached binary path.
func compileCs(scriptPath string, manifestDir string) (string, error) {
	baseName := strings.TrimSuffix(filepath.Base(scriptPath), ".cs")

	forgeDir := filepath.Join(manifestDir, ".forge")
	forgeCache := filepath.Join(forgeDir, "cache")

	buildDir := filepath.Join(forgeCache, baseName)
	if err := os.MkdirAll(buildDir, 0o755); err != nil {
		return "", fmt.Errorf("creating build dir: %w", err)
	}

	// Extract C# helpers.
	helpersDir := filepath.Join(forgeCache, "_helpers")
	csHelpersDir, err := embedded.ExtractHelpersCS(helpersDir)
	if err != nil {
		return "", fmt.Errorf("extracting cs helpers: %w", err)
	}

	// Keep the schema up-to-date.
	if _, err := embedded.ExtractSchema(forgeDir); err != nil {
		fmt.Fprintf(os.Stderr, "warning: could not extract schema: %v\n", err)
	}
	if _, err := embedded.ExtractTemplateSchema(forgeDir); err != nil {
		fmt.Fprintf(os.Stderr, "warning: could not extract template schema: %v\n", err)
	}

	// Ensure ForgeScripts.csproj exists for intellisense.
	if err := embedded.EnsureCSProj(forgeDir); err != nil {
		fmt.Fprintf(os.Stderr, "warning: could not create ForgeScripts.csproj: %v\n", err)
	}

	// Ensure ForgeScripts.slnx exists for C# Dev Kit.
	if err := embedded.EnsureSLNX(forgeDir); err != nil {
		fmt.Fprintf(os.Stderr, "warning: could not create ForgeScripts.slnx: %v\n", err)
	}

	// Compute content hash for caching.
	content, err := os.ReadFile(scriptPath)
	if err != nil {
		return "", fmt.Errorf("reading script: %w", err)
	}

	hash := sha256.Sum256(content)
	hashStr := hex.EncodeToString(hash[:8])

	hashFile := filepath.Join(buildDir, baseName+".hash")

	// The published output directory.
	publishDir := filepath.Join(buildDir, "bin", "publish")
	binaryName := "ForgeScript"
	if runtime.GOOS == "windows" {
		binaryName += ".exe"
	}
	cachedBinary := filepath.Join(publishDir, binaryName)

	// Check if we need to rebuild.
	needsBuild := true
	if existingHash, err := os.ReadFile(hashFile); err == nil {
		if string(existingHash) == hashStr {
			if _, err := os.Stat(cachedBinary); err == nil {
				needsBuild = false
			}
		}
	}

	if needsBuild {
		fmt.Printf("\033[90mcompiling %s...\033[0m\n", baseName)

		// Copy the script into the build directory.
		scriptDest := filepath.Join(buildDir, "script.cs")
		if err := os.WriteFile(scriptDest, content, 0o644); err != nil {
			return "", fmt.Errorf("copying script: %w", err)
		}

		// Generate .csproj that references the helpers project.
		absCsHelpers, err := filepath.Abs(csHelpersDir)
		if err != nil {
			return "", fmt.Errorf("resolving helpers path: %w", err)
		}

		csproj := generateCsproj(absCsHelpers)
		csprojPath := filepath.Join(buildDir, "ForgeScript.csproj")
		if err := os.WriteFile(csprojPath, []byte(csproj), 0o644); err != nil {
			return "", fmt.Errorf("writing .csproj: %w", err)
		}

		// Publish for fastest startup.
		buildCmd := exec.Command("dotnet", "publish",
			"-c", "Release",
			"-o", publishDir,
			"--nologo",
			"-v", "quiet",
		)
		buildCmd.Dir = buildDir
		buildCmd.Stdout = os.Stdout
		buildCmd.Stderr = os.Stderr

		if err := buildCmd.Run(); err != nil {
			return "", fmt.Errorf("compiling script: %w", err)
		}

		// Store the hash.
		if err := os.WriteFile(hashFile, []byte(hashStr), 0o644); err != nil {
			return "", fmt.Errorf("writing hash file: %w", err)
		}
	}

	return cachedBinary, nil
}

// generateCsproj produces a .csproj file for a C# forge script.
// It references the extracted ForgeHelpers project for access to helpers.
func generateCsproj(helpersProjectDir string) string {
	helpersCsproj := filepath.Join(helpersProjectDir, "ForgeHelpers.csproj")

	return fmt.Sprintf(`<Project Sdk="Microsoft.NET.Sdk">
	<PropertyGroup>
		<OutputType>Exe</OutputType>
		<TargetFramework>net9.0</TargetFramework>
		<ImplicitUsings>disable</ImplicitUsings>
		<Nullable>enable</Nullable>
		<AssemblyName>ForgeScript</AssemblyName>
	</PropertyGroup>
	<ItemGroup>
		<ProjectReference Include="%s" />
	</ItemGroup>
</Project>
`, helpersCsproj)
}

// execBinary runs a compiled binary from the current working directory.
// The CWD is the directory where forge was invoked, ensuring consistent
// behavior regardless of which manifest defined the command.
func execBinary(bin string, manifestDir string, args []string) error {
	runCmd := exec.Command(bin, args...)
	runCmd.Stdout = os.Stdout
	runCmd.Stderr = os.Stderr
	runCmd.Stdin = os.Stdin

	return runCmd.Run()
}

// Meta compiles a script (if needed) and invokes it with --forge-meta to
// retrieve the command's argument metadata as JSON. Returns nil if the script
// does not support introspection.
func Meta(cmd manifest.Command, m *manifest.Manifest) ([]byte, error) {
	if cmd.Script == "" {
		return nil, nil
	}

	scriptPath := resolveScriptPath(cmd)
	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("script not found: %s", scriptPath)
	}

	// Read the script source and check if it calls parse().
	// Scripts that don't use parse() have no arguments to report,
	// so we skip the expensive compilation + execution entirely.
	source, err := os.ReadFile(scriptPath)
	if err != nil {
		return nil, fmt.Errorf("reading script: %w", err)
	}
	src := string(source)

	ext := strings.ToLower(filepath.Ext(scriptPath))

	hasParse := false
	switch ext {
	case ".go":
		hasParse = strings.Contains(src, ".Parse()")
	case ".ts":
		hasParse = strings.Contains(src, ".parse()")
	case ".cs":
		hasParse = strings.Contains(src, ".Parse()")
	}

	if !hasParse {
		return nil, nil
	}

	var metaCmd *exec.Cmd

	switch ext {
	case ".go":
		bin, err := compileGo(scriptPath, cmd.ManifestDir)
		if err != nil {
			return nil, err
		}
		metaCmd = exec.Command(bin, "--forge-meta")

	case ".ts":
		absScript, err := PrepareTs(scriptPath, cmd.ManifestDir)
		if err != nil {
			return nil, err
		}
		metaCmd = exec.Command("node", absScript, "--forge-meta")

	case ".cs":
		bin, err := compileCs(scriptPath, cmd.ManifestDir)
		if err != nil {
			return nil, err
		}
		metaCmd = exec.Command(bin, "--forge-meta")

	default:
		return nil, nil
	}

	metaCmd.Dir = cmd.ManifestDir

	// Use a timeout so slow scripts (e.g. TS cold-start) don't hang forever.
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	done := make(chan struct{})
	var output []byte
	var metaErr error

	go func() {
		output, metaErr = metaCmd.Output()
		close(done)
	}()

	select {
	case <-done:
		if metaErr != nil {
			// Script doesn't support --forge-meta introspection.
			return nil, nil
		}
		return output, nil
	case <-ctx.Done():
		if metaCmd.Process != nil {
			metaCmd.Process.Kill()
		}
		return nil, fmt.Errorf("meta timed out after 30s")
	}
}
