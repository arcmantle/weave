//go:build ignore

// Build script for yeetm — cross-compiles for all supported platforms
// and generates per-platform npm packages.
//
// Usage:
//
//	go run build.go <version>            — build only
//	go run build.go <version> --publish  — build + npm publish all packages
package main

import (
	"bufio"
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

type target struct {
	goos   string
	goarch string
	npmOs  string // npm "os" field value
	npmCpu string // npm "cpu" field value
}

var targets = []target{
	{"linux", "amd64", "linux", "x64"},
	{"linux", "arm64", "linux", "arm64"},
	{"darwin", "amd64", "darwin", "x64"},
	{"darwin", "arm64", "darwin", "arm64"},
	{"windows", "amd64", "win32", "x64"},
	{"windows", "arm64", "win32", "arm64"},
}

var colors = []string{
	"\033[36m", "\033[33m", "\033[35m",
	"\033[32m", "\033[34m", "\033[31m",
}

func main() {
	version := ""
	publish := false
	otp := ""

	for _, arg := range os.Args[1:] {
		if arg == "--publish" {
			publish = true
		} else if strings.HasPrefix(arg, "--otp=") {
			otp = strings.TrimPrefix(arg, "--otp=")
		} else if version == "" {
			version = arg
		}
	}

	yeetmDir, err := os.Getwd()
	if err != nil {
		fatal("failed to get working directory: %v", err)
	}

	if _, err := os.Stat(filepath.Join(yeetmDir, "go.mod")); os.IsNotExist(err) {
		fatal("build.go must be run from the tooling/yeetm/ directory")
	}

	// If no version provided, read it from package.json.
	if version == "" {
		version, err = readVersionFromPackageJSON(yeetmDir)
		if err != nil {
			fatal("no version argument and failed to read package.json: %v", err)
		}

		info("using version %s from package.json", version)
	}

	distDir := filepath.Join(yeetmDir, "dist")

	os.RemoveAll(distDir)
	if err := os.MkdirAll(distDir, 0o755); err != nil {
		fatal("failed to create dist dir: %v", err)
	}

	ldflags := fmt.Sprintf("-s -w -X main.version=%s", version)
	pkg := "."

	info("building yeetm v%s for %d targets", version, len(targets))
	fmt.Println()

	start := time.Now()

	for i, t := range targets {
		ext := ""
		if t.goos == "windows" {
			ext = ".exe"
		}

		binaryName := "yeetm" + ext
		platformPkg := platformPkgName(t)
		pkgDir := filepath.Join(distDir, "npm", platformPkg)

		if err := os.MkdirAll(pkgDir, 0o755); err != nil {
			fatal("failed to create package dir: %v", err)
		}

		outPath := filepath.Join(pkgDir, binaryName)

		color := colors[i%len(colors)]
		label := fmt.Sprintf("%-16s", t.goos+"/"+t.goarch)
		fmt.Printf("  %s%s\033[0m building...", color, label)

		cmd := exec.Command("go", "build", "-trimpath", "-ldflags", ldflags, "-o", outPath, pkg)
		cmd.Dir = yeetmDir
		cmd.Env = append(os.Environ(),
			"GOOS="+t.goos,
			"GOARCH="+t.goarch,
			"CGO_ENABLED=0",
		)

		output, err := cmd.CombinedOutput()
		if err != nil {
			fmt.Printf(" \033[31m✗ failed\033[0m\n")
			fmt.Fprintf(os.Stderr, "%s\n", output)
			fatal("build failed for %s/%s: %v", t.goos, t.goarch, err)
		}

		fi, _ := os.Stat(outPath)
		sizeMB := float64(fi.Size()) / 1024 / 1024

		fmt.Printf("\r  %s%s\033[0m \033[32m✓\033[0m %.1f MB\n", color, label, sizeMB)

		// Write per-platform package.json.
		if err := writePlatformPackageJSON(pkgDir, t, version); err != nil {
			fatal("failed to write package.json for %s: %v", platformPkg, err)
		}
	}

	elapsed := time.Since(start)

	// Generate checksums.
	info("generating checksums...")
	if err := generateChecksums(distDir); err != nil {
		fatal("failed to generate checksums: %v", err)
	}

	fmt.Println()
	success("built %d platform packages in %s", len(targets), elapsed.Round(time.Millisecond))
	info("output: tooling/yeetm/dist/npm/")
	info("go: %s | host: %s/%s", runtime.Version(), runtime.GOOS, runtime.GOARCH)

	if !publish {
		fmt.Println()
		info("run with --publish to publish all packages to npm")
		return
	}

	// Prompt for OTP after build if not provided via flag.
	if otp == "" {
		fmt.Println()
		fmt.Print("\033[36m?\033[0m Enter npm OTP code: ")

		scanner := bufio.NewScanner(os.Stdin)
		if scanner.Scan() {
			otp = strings.TrimSpace(scanner.Text())
		}

		if otp == "" {
			fatal("OTP is required for publishing")
		}
	}

	// Build list of all packages to publish.
	type publishJob struct {
		name  string
		dir   string
		color string
	}

	var jobs []publishJob
	for i, t := range targets {
		jobs = append(jobs, publishJob{
			name:  "@arcmantle/" + platformPkgName(t),
			dir:   filepath.Join(distDir, "npm", platformPkgName(t)),
			color: colors[i%len(colors)],
		})
	}
	jobs = append(jobs, publishJob{
		name:  "yeetm",
		dir:   yeetmDir,
		color: "\033[36m",
	})

	fmt.Println()
	info("publishing %d packages in parallel...", len(jobs))
	fmt.Println()

	for _, j := range jobs {
		fmt.Printf("  %s%s\033[0m publishing...\n", j.color, j.name)
	}

	type publishResult struct {
		name   string
		color  string
		output string
		err    error
	}

	results := make([]publishResult, len(jobs))
	var wg sync.WaitGroup

	for i, j := range jobs {
		wg.Add(1)
		go func(idx int, job publishJob) {
			defer wg.Done()

			publishArgs := []string{"publish", "--access", "public"}
			if otp != "" {
				publishArgs = append(publishArgs, "--otp="+otp)
			}

			cmd := exec.Command("npm", publishArgs...)
			cmd.Dir = job.dir

			var buf bytes.Buffer
			cmd.Stdout = &buf
			cmd.Stderr = &buf

			err := cmd.Run()
			results[idx] = publishResult{
				name:   job.name,
				color:  job.color,
				output: buf.String(),
				err:    err,
			}
		}(i, j)
	}

	wg.Wait()

	fmt.Println()

	var failed []publishResult
	for _, r := range results {
		if r.err != nil {
			fmt.Printf("  %s%s\033[0m \033[31m✗ failed\033[0m\n", r.color, r.name)
			failed = append(failed, r)
		} else {
			fmt.Printf("  %s%s\033[0m \033[32m✓\033[0m published\n", r.color, r.name)
		}
	}

	if len(failed) > 0 {
		fmt.Println()
		for _, r := range failed {
			fmt.Fprintf(os.Stderr, "\033[31m--- %s ---\033[0m\n%s\n", r.name, r.output)
		}
		fatal("%d of %d packages failed to publish", len(failed), len(jobs))
	}

	fmt.Println()
	success("published yeetm v%s (%d packages)", version, len(jobs))
}

// platformPkgName returns the npm package name suffix, e.g. "yeetm-linux-x64".
func platformPkgName(t target) string {
	return fmt.Sprintf("yeetm-%s-%s", t.npmOs, t.npmCpu)
}

func readVersionFromPackageJSON(dir string) (string, error) {
	data, err := os.ReadFile(filepath.Join(dir, "package.json"))
	if err != nil {
		return "", err
	}

	var pkg struct {
		Version string `json:"version"`
	}

	if err := json.Unmarshal(data, &pkg); err != nil {
		return "", err
	}

	if pkg.Version == "" {
		return "", fmt.Errorf("version field is empty in package.json")
	}

	return pkg.Version, nil
}

func writePlatformPackageJSON(dir string, t target, version string) error {
	ext := ""
	if t.goos == "windows" {
		ext = ".exe"
	}

	pkg := map[string]any{
		"name":        "@arcmantle/" + platformPkgName(t),
		"version":     version,
		"description": fmt.Sprintf("yeetm binary for %s/%s", t.npmOs, t.npmCpu),
		"os":          []string{t.npmOs},
		"cpu":         []string{t.npmCpu},
		"main":        "yeetm" + ext,
		"files":       []string{"yeetm" + ext},
		"publishConfig": map[string]string{
			"access": "public",
		},
	}

	data, err := json.MarshalIndent(pkg, "", "\t")
	if err != nil {
		return err
	}

	return os.WriteFile(filepath.Join(dir, "package.json"), append(data, '\n'), 0o644)
}

func generateChecksums(distDir string) error {
	npmDir := filepath.Join(distDir, "npm")
	entries, err := os.ReadDir(npmDir)
	if err != nil {
		return err
	}

	var lines []string
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		pkgDir := filepath.Join(npmDir, entry.Name())
		files, err := os.ReadDir(pkgDir)
		if err != nil {
			return err
		}

		for _, f := range files {
			if f.IsDir() || strings.HasSuffix(f.Name(), ".json") {
				continue
			}

			data, err := os.ReadFile(filepath.Join(pkgDir, f.Name()))
			if err != nil {
				return err
			}

			hash := sha256sum(data)
			name := entry.Name() + "/" + f.Name()
			lines = append(lines, fmt.Sprintf("%s  %s", hash, name))
		}
	}

	content := strings.Join(lines, "\n") + "\n"
	return os.WriteFile(filepath.Join(distDir, "checksums.txt"), []byte(content), 0o644)
}

func sha256sum(data []byte) string {
	h := sha256.Sum256(data)
	return fmt.Sprintf("%x", h)
}

func info(format string, args ...any) {
	fmt.Printf("\033[36minfo:\033[0m "+format+"\n", args...)
}

func success(format string, args ...any) {
	fmt.Printf("\033[32m✓\033[0m "+format+"\n", args...)
}

func fatal(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "\033[31merror:\033[0m "+format+"\n", args...)
	os.Exit(1)
}
