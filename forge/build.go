//go:build ignore

// Build script for forge — cross-compiles for all supported platforms.
// Run via: go run build.go [version]
package main

import (
	"crypto/sha256"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

type target struct {
	goos   string
	goarch string
}

var targets = []target{
	{"linux", "amd64"},
	{"linux", "arm64"},
	{"darwin", "amd64"},
	{"darwin", "arm64"},
	{"windows", "amd64"},
	{"windows", "arm64"},
}

var colors = []string{
	"\033[36m", "\033[33m", "\033[35m",
	"\033[32m", "\033[34m", "\033[31m",
}

func main() {
	version := "0.1.0"
	if len(os.Args) > 1 {
		version = os.Args[1]
	}

	forgeDir, err := os.Getwd()
	if err != nil {
		fatal("failed to get working directory: %v", err)
	}

	if _, err := os.Stat(filepath.Join(forgeDir, "go.mod")); os.IsNotExist(err) {
		fatal("build.go must be run from the forge/ directory")
	}

	distDir := filepath.Join(forgeDir, "dist")

	os.RemoveAll(distDir)
	if err := os.MkdirAll(distDir, 0o755); err != nil {
		fatal("failed to create dist dir: %v", err)
	}

	ldflags := fmt.Sprintf("-s -w -X main.version=%s", version)
	pkg := "./cmd/forge/"

	info("building forge v%s for %d targets", version, len(targets))
	fmt.Println()

	start := time.Now()

	for i, t := range targets {
		ext := ""
		if t.goos == "windows" {
			ext = ".exe"
		}

		binaryName := fmt.Sprintf("forge-%s-%s%s", t.goos, t.goarch, ext)
		outPath := filepath.Join(distDir, binaryName)

		color := colors[i%len(colors)]
		label := fmt.Sprintf("%-16s", t.goos+"/"+t.goarch)
		fmt.Printf("  %s%s\033[0m building...", color, label)

		cmd := exec.Command("go", "build", "-ldflags", ldflags, "-o", outPath, pkg)
		cmd.Dir = forgeDir
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
	}

	elapsed := time.Since(start)

	// Generate checksums.
	info("generating checksums...")
	if err := generateChecksums(distDir, filepath.Join(distDir, "checksums.txt")); err != nil {
		fatal("failed to generate checksums: %v", err)
	}

	fmt.Println()
	success("built %d binaries in %s", len(targets), elapsed.Round(time.Millisecond))
	info("output: forge/dist/")
	info("go: %s | host: %s/%s", runtime.Version(), runtime.GOOS, runtime.GOARCH)
}

func generateChecksums(dir string, outPath string) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}

	var lines []string
	for _, entry := range entries {
		if entry.IsDir() || strings.HasSuffix(entry.Name(), ".txt") {
			continue
		}

		data, err := os.ReadFile(filepath.Join(dir, entry.Name()))
		if err != nil {
			return err
		}

		hash := sha256sum(data)
		lines = append(lines, fmt.Sprintf("%s  %s", hash, entry.Name()))
	}

	content := strings.Join(lines, "\n") + "\n"
	return os.WriteFile(outPath, []byte(content), 0o644)
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
