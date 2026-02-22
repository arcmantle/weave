package main

import (
	"bufio"
	"flag"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
)

var version = "1.0.0"

func main() {
	dryRun := flag.Bool("dry-run", false, "List what would be removed without deleting")
	shortDryRun := flag.Bool("d", false, "Shorthand for --dry-run")

	verbose := flag.Bool("verbose", false, "Show size of each node_modules folder")
	shortVerbose := flag.Bool("v", false, "Shorthand for --verbose")

	yes := flag.Bool("yes", false, "Skip confirmation prompt")
	shortYes := flag.Bool("y", false, "Shorthand for --yes")

	var excludes stringSlice
	flag.Var(&excludes, "exclude", "Exclude directories from scanning (repeatable)")
	flag.Var(&excludes, "e", "Shorthand for --exclude")

	showVersion := flag.Bool("version", false, "Show version number")
	showHelp := flag.Bool("help", false, "Show help")
	shortHelp := flag.Bool("h", false, "Shorthand for --help")

	flag.Usage = printHelp
	flag.Parse()

	if *showHelp || *shortHelp {
		printHelp()
		os.Exit(0)
	}

	if *showVersion {
		fmt.Println(version)
		os.Exit(0)
	}

	targetDir := "."
	if flag.NArg() > 0 {
		targetDir = flag.Arg(0)
	}

	absTarget, err := filepath.Abs(targetDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error resolving path: %v\n", err)
		os.Exit(1)
	}

	opts := options{
		targetDir: absTarget,
		dryRun:    *dryRun || *shortDryRun,
		verbose:   *verbose || *shortVerbose,
		yes:       *yes || *shortYes,
		exclude:   buildExcludeSet(excludes),
	}

	os.Exit(run(opts))
}

type stringSlice []string

func (s *stringSlice) String() string { return strings.Join(*s, ", ") }
func (s *stringSlice) Set(val string) error {
	*s = append(*s, val)

	return nil
}

type options struct {
	targetDir string
	dryRun    bool
	verbose   bool
	yes       bool
	exclude   map[string]bool
}

func buildExcludeSet(extra []string) map[string]bool {
	set := map[string]bool{
		".git": true,
	}
	for _, e := range extra {
		set[e] = true
	}

	return set
}

func printHelp() {
	help := `
  yeetm — Recursively remove all node_modules folders

  Usage:
    yeetm [directory] [options]

  Arguments:
    directory              Target directory to scan (defaults to cwd)

  Options:
    -y, --yes              Skip confirmation prompt
    -d, --dry-run          List what would be removed without deleting
    -v, --verbose          Show size of each node_modules folder
    -e, --exclude <dir>    Exclude directories from scanning (repeatable)
    -h, --help             Show this help message
    --version              Show version number

  Examples:
    yeetm                                 Yeet all node_modules from cwd
    yeetm ./projects                      Target a specific directory
    yeetm --dry-run --verbose              Preview with sizes
    yeetm -y -e vendor                     Skip prompt, ignore vendor/
    yeetm -e dist -e build                 Exclude multiple directories

  Install:
    go install github.com/arcmantle/yeetm@latest
`
	fmt.Print(help)
}

func run(opts options) int {
	fmt.Printf("\n🔍 Scanning for node_modules in %s...\n\n", opts.targetDir)

	dirs := findNodeModules(opts.targetDir, opts.exclude)

	if len(dirs) == 0 {
		fmt.Println("✨ No node_modules folders found. Already clean!")

		return 0
	}

	plural := ""
	if len(dirs) > 1 {
		plural = "s"
	}

	fmt.Printf("Found %d node_modules folder%s:\n\n", len(dirs), plural)

	var totalSize int64
	for _, dir := range dirs {
		if opts.verbose {
			size := getDirSize(dir)
			totalSize += size
			fmt.Printf("  📁 %s (%s)\n", dir, formatBytes(size))
		} else {
			fmt.Printf("  📁 %s\n", dir)
		}
	}

	if opts.verbose {
		fmt.Printf("\nTotal size: %s\n", formatBytes(totalSize))
	}

	if opts.dryRun {
		fmt.Println("\n🏃 Dry run — no folders were removed.")

		return 0
	}

	if !opts.yes {
		fmt.Printf("\nRemove %d folder%s? (y/N) ", len(dirs), plural)
		if !confirm() {
			fmt.Println("\n👋 Aborted.")

			return 0
		}
	}

	fmt.Println("\n🗑️  Removing...")

	removed, failed := removeDirs(dirs)

	if failed == 0 {
		fmt.Printf("\n✨ Yeeted %d folder%s!\n", removed, plural)
	} else {
		fmt.Printf("\n⚠️  Removed %d/%d folders. Some failed — check errors above.\n", removed, len(dirs))
	}

	return 0
}

func findNodeModules(root string, exclude map[string]bool) []string {
	var found []string

	entries, err := os.ReadDir(root)
	if err != nil {
		return found
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		name := entry.Name()

		if exclude[name] {
			continue
		}

		fullPath := filepath.Join(root, name)

		if name == "node_modules" {
			found = append(found, fullPath)
		} else {
			found = append(found, findNodeModules(fullPath, exclude)...)
		}
	}

	return found
}

func getDirSize(path string) int64 {
	var size int64

	_ = filepath.WalkDir(path, func(_ string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if !d.IsDir() {
			info, err := d.Info()
			if err == nil {
				size += info.Size()
			}
		}

		return nil
	})

	return size
}

func formatBytes(bytes int64) string {
	if bytes == 0 {
		return "0 B"
	}

	units := []string{"B", "KB", "MB", "GB", "TB"}
	size := float64(bytes)
	i := 0

	for size >= 1024 && i < len(units)-1 {
		size /= 1024
		i++
	}

	return fmt.Sprintf("%.2f %s", size, units[i])
}

func confirm() bool {
	scanner := bufio.NewScanner(os.Stdin)
	if scanner.Scan() {
		return strings.TrimSpace(strings.ToLower(scanner.Text())) == "y"
	}

	return false
}

func removeDirs(dirs []string) (removed int, failed int) {
	var wg sync.WaitGroup
	var successCount atomic.Int32
	var failCount atomic.Int32

	for _, dir := range dirs {
		wg.Add(1)
		go func(d string) {
			defer wg.Done()

			if err := os.RemoveAll(d); err != nil {
				fmt.Fprintf(os.Stderr, "  ❌ %s: %v\n", d, err)
				failCount.Add(1)
			} else {
				fmt.Printf("  ✅ %s\n", d)
				successCount.Add(1)
			}
		}(dir)
	}

	wg.Wait()

	return int(successCount.Load()), int(failCount.Load())
}
