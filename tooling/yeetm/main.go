package main

import (
	"bufio"
	"flag"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
)

var version = "1.2.0"

func main() {
	dryRun := flag.Bool("dry-run", false, "List what would be removed without deleting")
	shortDryRun := flag.Bool("d", false, "Shorthand for --dry-run")

	verbose := flag.Bool("verbose", false, "Show size of each node_modules folder")
	shortVerbose := flag.Bool("v", false, "Shorthand for --verbose")

	yes := flag.Bool("yes", false, "Skip confirmation prompt")
	shortYes := flag.Bool("y", false, "Shorthand for --yes")

	jobs := flag.Int("jobs", 0, "Number of concurrent workers (default: number of CPUs)")
	shortJobs := flag.Int("j", 0, "Shorthand for --jobs")

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

	j := *jobs
	if *shortJobs > 0 {
		j = *shortJobs
	}
	if j <= 0 {
		j = runtime.NumCPU()
	}

	opts := options{
		targetDir: absTarget,
		dryRun:    *dryRun || *shortDryRun,
		verbose:   *verbose || *shortVerbose,
		yes:       *yes || *shortYes,
		jobs:      j,
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
	jobs      int
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
    -j, --jobs <n>         Number of concurrent workers (default: number of CPUs)
    -e, --exclude <dir>    Exclude directories from scanning (repeatable)
    -h, --help             Show this help message
    --version              Show version number

  Examples:
    yeetm                                 Yeet all node_modules from cwd
    yeetm ./projects                      Target a specific directory
    yeetm --dry-run --verbose              Preview with sizes
    yeetm -y -e vendor                     Skip prompt, ignore vendor/
    yeetm -e dist -e build                 Exclude multiple directories
    yeetm -j 16                            Use 16 workers for fast SSDs

  Install:
    go install github.com/arcmantle/yeetm@latest
`
	fmt.Print(help)
}

func run(opts options) int {
	fmt.Printf("\n🔍 Scanning for node_modules in %s...\n\n", opts.targetDir)

	dirs := findNodeModules(opts.targetDir, opts.exclude, opts.jobs)

	if len(dirs) == 0 {
		fmt.Println("✨ No node_modules folders found. Already clean!")

		return 0
	}

	sort.Strings(dirs)

	plural := ""
	if len(dirs) > 1 {
		plural = "s"
	}

	fmt.Printf("Found %d node_modules folder%s:\n\n", len(dirs), plural)

	if opts.verbose {
		sizes := getDirSizes(dirs, opts.jobs)

		var totalSize int64
		for i, dir := range dirs {
			totalSize += sizes[i]
			fmt.Printf("  📁 %s (%s)\n", dir, formatBytes(sizes[i]))
		}

		fmt.Printf("\nTotal size: %s\n", formatBytes(totalSize))
	} else {
		for _, dir := range dirs {
			fmt.Printf("  📁 %s\n", dir)
		}
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

	removed, failed := removeDirs(dirs, opts.jobs)

	if failed == 0 {
		fmt.Printf("\n✨ Yeeted %d folder%s!\n", removed, plural)
	} else {
		fmt.Printf("\n⚠️  Removed %d/%d folders. Some failed — check errors above.\n", removed, len(dirs))
	}

	return 0
}

// findNodeModules concurrently walks the directory tree to find all node_modules
// folders. It uses a semaphore to bound concurrency and falls back to inline
// processing when all workers are busy, preventing deadlocks.
func findNodeModules(root string, exclude map[string]bool, jobs int) []string {
	var (
		mu    sync.Mutex
		found = make([]string, 0, 32)
		wg    sync.WaitGroup
		sem   = make(chan struct{}, jobs)
	)

	var walk func(dir string)
	walk = func(dir string) {
		defer wg.Done()

		entries, err := readDirUnsorted(dir)
		if err != nil {
			return
		}

		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}

			name := entry.Name()

			if exclude[name] {
				continue
			}

			fullPath := filepath.Join(dir, name)

			if name == "node_modules" {
				mu.Lock()
				found = append(found, fullPath)
				mu.Unlock()
			} else {
				wg.Add(1)

				select {
				case sem <- struct{}{}:
					go func() {
						walk(fullPath)
						<-sem
					}()
				default:
					walk(fullPath)
				}
			}
		}
	}

	wg.Add(1)
	walk(root)
	wg.Wait()

	return found
}

// readDirUnsorted reads directory entries without sorting them, avoiding the
// O(n log n) sort overhead imposed by os.ReadDir on every directory.
func readDirUnsorted(dir string) ([]fs.DirEntry, error) {
	f, err := os.Open(dir)
	if err != nil {
		return nil, err
	}

	entries, err := f.ReadDir(-1)
	f.Close()

	return entries, err
}

// getDirSizes concurrently computes the size of each directory using a shared
// semaphore for bounded concurrency across all trees simultaneously.
func getDirSizes(dirs []string, jobs int) []int64 {
	sizes := make([]int64, len(dirs))

	var wg sync.WaitGroup
	sem := make(chan struct{}, jobs)

	for i, dir := range dirs {
		wg.Add(1)

		go func(idx int, path string) {
			defer wg.Done()

			var total atomic.Int64
			getDirSize(path, sem, &total)
			sizes[idx] = total.Load()
		}(i, dir)
	}

	wg.Wait()

	return sizes
}

// getDirSize concurrently computes total file size using the semaphore+select
// fallback pattern. Falls back to inline processing when all workers are busy,
// preventing deadlocks in recursive tree walks.
func getDirSize(path string, sem chan struct{}, total *atomic.Int64) {
	entries, err := readDirUnsorted(path)
	if err != nil {
		return
	}

	var (
		wg   sync.WaitGroup
		size int64
	)

	for _, entry := range entries {
		if entry.IsDir() {
			child := filepath.Join(path, entry.Name())

			wg.Add(1)

			select {
			case sem <- struct{}{}:
				go func(p string) {
					defer wg.Done()
					defer func() { <-sem }()

					getDirSize(p, sem, total)
				}(child)
			default:
				getDirSize(child, sem, total)
				wg.Done()
			}
		} else if info, err := entry.Info(); err == nil {
			size += info.Size()
		}
	}

	total.Add(size)
	wg.Wait()
}

var byteUnits = [...]string{"B", "KB", "MB", "GB", "TB"}

func formatBytes(bytes int64) string {
	if bytes == 0 {
		return "0 B"
	}

	size := float64(bytes)
	i := 0

	for size >= 1024 && i < len(byteUnits)-1 {
		size /= 1024
		i++
	}

	return fmt.Sprintf("%.2f %s", size, byteUnits[i])
}

func confirm() bool {
	scanner := bufio.NewScanner(os.Stdin)
	if scanner.Scan() {
		return strings.TrimSpace(strings.ToLower(scanner.Text())) == "y"
	}

	return false
}

// parallelRemoveAll deletes a directory tree using concurrent workers for both
// subdirectory traversal and batched file deletion. Falls back to inline
// processing when all workers are busy, preventing deadlocks.
func parallelRemoveAll(root string, sem chan struct{}) error {
	entries, err := readDirUnsorted(root)
	if err != nil {
		// Can't read — try direct remove (might be a file, symlink, or empty dir).
		return os.Remove(root)
	}

	var (
		wg    sync.WaitGroup
		files = make([]string, 0, len(entries))
	)

	// Process subdirectories concurrently.
	for _, entry := range entries {
		child := filepath.Join(root, entry.Name())

		if entry.IsDir() {
			wg.Add(1)

			select {
			case sem <- struct{}{}:
				go func(p string) {
					defer wg.Done()
					defer func() { <-sem }()

					parallelRemoveAll(p, sem)
				}(child)
			default:
				parallelRemoveAll(child, sem)
				wg.Done()
			}
		} else {
			files = append(files, child)
		}
	}

	// Delete files in batches across goroutines to avoid per-file goroutine overhead
	// while still parallelizing I/O across the filesystem.
	const batchSize = 128
	for i := 0; i < len(files); i += batchSize {
		end := min(i+batchSize, len(files))
		batch := files[i:end]

		wg.Add(1)

		select {
		case sem <- struct{}{}:
			go func(b []string) {
				defer wg.Done()
				defer func() { <-sem }()

				for _, p := range b {
					os.Remove(p)
				}
			}(batch)
		default:
			for _, p := range batch {
				os.Remove(p)
			}
			wg.Done()
		}
	}

	wg.Wait()

	return os.Remove(root)
}

// removeDirs deletes directories concurrently using parallelRemoveAll with a
// shared semaphore, allowing work to be distributed across all directory trees.
func removeDirs(dirs []string, jobs int) (removed int, failed int) {
	var wg sync.WaitGroup
	var successCount atomic.Int32
	var failCount atomic.Int32

	// Shared semaphore across all directory trees for bounded I/O concurrency.
	sem := make(chan struct{}, jobs*4)

	for _, dir := range dirs {
		wg.Add(1)

		go func(d string) {
			defer wg.Done()

			if err := parallelRemoveAll(d, sem); err != nil {
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
