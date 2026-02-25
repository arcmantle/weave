//go:build ignore

package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"time"
)

type target struct {
	goos   string
	goarch string
	name   string
}

var targets = []target{
	{"windows", "amd64", "yeetm-win-x64.exe"},
	{"windows", "arm64", "yeetm-win-arm64.exe"},
	{"linux", "amd64", "yeetm-linux-x64"},
	{"linux", "arm64", "yeetm-linux-arm64"},
	{"darwin", "amd64", "yeetm-darwin-x64"},
	{"darwin", "arm64", "yeetm-darwin-arm64"},
}

func main() {
	start := time.Now()
	ver := readVersion()
	ldflags := "-s -w -X main.version=" + ver

	fmt.Printf("Building %d targets...\n\n", len(targets))

	type buildResult struct {
		name string
		size int64
		err  error
	}

	results := make([]buildResult, len(targets))

	var wg sync.WaitGroup
	for i, t := range targets {
		wg.Add(1)

		go func(idx int, t target) {
			defer wg.Done()

			out := "bin/" + t.name
			cmd := exec.Command("go", "build", "-trimpath", "-ldflags", ldflags, "-o", out, ".")
			cmd.Env = append(os.Environ(),
				"CGO_ENABLED=0",
				"GOOS="+t.goos,
				"GOARCH="+t.goarch,
			)

			if err := cmd.Run(); err != nil {
				results[idx] = buildResult{name: t.name, err: err}

				return
			}

			info, _ := os.Stat(out)
			results[idx] = buildResult{name: t.name, size: info.Size()}
		}(i, t)
	}

	wg.Wait()

	for _, r := range results {
		if r.err != nil {
			fmt.Printf("  %-36s FAILED: %v\n", r.name, r.err)
			os.Exit(1)
		}

		fmt.Printf("  %-36s%6d KB\n", r.name, r.size/1024)
	}

	// Try UPX compression if available.
	upx, err := exec.LookPath("upx")
	if err != nil {
		fmt.Println("\nUPX not found, skipping compression.")
		fmt.Println("Install UPX for smaller binaries: https://upx.github.io")
	} else {
		fmt.Println("\nCompressing with UPX...")

		for _, t := range targets {
			// UPX doesn't support macOS or Windows ARM64.
			if t.goos == "darwin" || (t.goos == "windows" && t.goarch == "arm64") {
				continue
			}

			out := "bin/" + t.name
			fmt.Printf("  %-36s", t.name)

			cmd := exec.Command(upx, "--best", "--quiet", out)
			cmd.Stderr = os.Stderr

			if err := cmd.Run(); err != nil {
				fmt.Printf("skipped (%v)\n", err)

				continue
			}

			info, _ := os.Stat(out)
			fmt.Printf("%6d KB\n", info.Size()/1024)
		}
	}

	fmt.Printf("\nDone in %s (%s/%s)\n", time.Since(start).Round(time.Millisecond), runtime.GOOS, runtime.GOARCH)

	// Print summary.
	fmt.Println("\nFinal sizes:")
	var total int64
	maxName := 0
	for _, t := range targets {
		if len(t.name) > maxName {
			maxName = len(t.name)
		}
	}

	for _, t := range targets {
		out := "bin/" + t.name
		info, err := os.Stat(out)
		if err != nil {
			continue
		}

		size := info.Size()
		total += size
		bar := strings.Repeat("█", int(size/1024/50))
		fmt.Printf("  %-*s  %6d KB  %s\n", maxName, t.name, size/1024, bar)
	}

	fmt.Printf("\n  Total: %d KB\n", total/1024)
}

func readVersion() string {
	data, err := os.ReadFile("package.json")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Warning: could not read package.json: %v\n", err)

		return "dev"
	}

	var pkg struct{ Version string }
	if err := json.Unmarshal(data, &pkg); err != nil {
		fmt.Fprintf(os.Stderr, "Warning: could not parse package.json: %v\n", err)

		return "dev"
	}

	return pkg.Version
}
