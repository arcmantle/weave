package main

import (
	"bufio"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
)

var version = "dev"

func main() {
	dryRun := flag.Bool("dry-run", false, "List what would be removed without deleting")
	shortDryRun := flag.Bool("d", false, "Shorthand for --dry-run")

	verbose := flag.Bool("verbose", false, "Show size of each matching folder")
	shortVerbose := flag.Bool("v", false, "Shorthand for --verbose")

	yes := flag.Bool("yes", false, "Skip confirmation prompt")
	shortYes := flag.Bool("y", false, "Shorthand for --yes")

	debug := flag.Bool("debug", false, "Show scan and removal errors")
	shortDebug := flag.Bool("D", false, "Shorthand for --debug")

	jobs := flag.Int("jobs", 0, "Number of concurrent workers (default: number of CPUs)")
	shortJobs := flag.Int("j", 0, "Shorthand for --jobs")

	dir := flag.String("dir", "", "Target directory to scan (defaults to cwd)")
	shortDir := flag.String("C", "", "Shorthand for --dir")

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

	patterns := flag.Args()
	if len(patterns) == 0 {
		patterns = []string{"node_modules"}
	}

	for _, p := range patterns {
		if _, err := filepath.Match(p, ""); err != nil {
			fmt.Fprintf(os.Stderr, "Invalid glob pattern %q: %v\n", p, err)
			os.Exit(1)
		}
	}

	targetDir := *dir
	if *shortDir != "" {
		targetDir = *shortDir
	}
	if targetDir == "" {
		targetDir = "."
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
		patterns:  patterns,
		dryRun:    *dryRun || *shortDryRun,
		verbose:   *verbose || *shortVerbose,
		debug:     *debug || *shortDebug,
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
	patterns  []string
	dryRun    bool
	verbose   bool
	debug     bool
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
  yeetm — Recursively find and remove directories and files by name

  Usage:
    yeetm [patterns...] [options]

  Arguments:
    patterns               Glob patterns to match names (default: node_modules)

  Options:
    -C, --dir <path>       Target directory to scan (defaults to cwd)
    -y, --yes              Skip confirmation prompt
    -d, --dry-run          List what would be removed without deleting
    -v, --verbose          Show size of each match
    -D, --debug            Show scan and removal errors
    -j, --jobs <n>         Number of concurrent workers (default: number of CPUs)
    -e, --exclude <dir>    Exclude directories from scanning (repeatable)
    -h, --help             Show this help message
    --version              Show version number

  Examples:
    yeetm                                 Yeet all node_modules from cwd
    yeetm dist                             Remove all dist directories
    yeetm node_modules dist                Remove both node_modules and dist
    yeetm "*.log"                           Remove all .log files
    yeetm -C ./projects                    Target a specific directory
    yeetm --dry-run --verbose              Preview with sizes
    yeetm -y -e vendor                     Skip prompt, ignore vendor/
    yeetm -e .cache -e build               Exclude multiple directories
    yeetm -j 16                            Use 16 workers for fast SSDs

  Install:
    go install github.com/arcmantle/weave/tooling/yeetm@latest

	Safety:
	  Never traverses symlinked/reparse-point directories
`
	fmt.Print(help)
}

func patternLabel(patterns []string) string {
	return strings.Join(patterns, ", ")
}

// match represents a found file or directory that matched a pattern.
type match struct {
	path  string
	isDir bool
}

func run(opts options) int {
	var errw io.Writer
	if opts.verbose || opts.debug {
		errw = os.Stderr
	}

	label := patternLabel(opts.patterns)

	fmt.Printf("\n🔍 Scanning for %s in %s...\n\n", label, opts.targetDir)

	matches := findMatches(opts.targetDir, opts.patterns, opts.exclude, opts.jobs, errw)

	if len(matches) == 0 {
		fmt.Printf("✨ No matches for %s found. Already clean!\n", label)

		return 0
	}

	sort.Slice(matches, func(i, j int) bool {
		return matches[i].path < matches[j].path
	})

	var dirCount, fileCount int
	for _, m := range matches {
		if m.isDir {
			dirCount++
		} else {
			fileCount++
		}
	}

	fmt.Printf("Found %d match%s", len(matches), matchPlural(len(matches)))
	if dirCount > 0 && fileCount > 0 {
		fmt.Printf(" (%d folder%s, %d file%s)", dirCount, plural2(dirCount), fileCount, plural2(fileCount))
	}
	fmt.Print(":\n\n")

	if opts.verbose {
		sizes := getMatchSizes(matches, opts.jobs, errw)

		var totalSize int64
		for i, m := range matches {
			totalSize += sizes[i]
			fmt.Printf("  %s %s (%s)\n", matchIcon(m.isDir), m.path, formatBytes(sizes[i]))
		}

		fmt.Printf("\nTotal size: %s\n", formatBytes(totalSize))
	} else {
		for _, m := range matches {
			fmt.Printf("  %s %s\n", matchIcon(m.isDir), m.path)
		}
	}

	if opts.dryRun {
		fmt.Println("\n🏃 Dry run — nothing was removed.")

		return 0
	}

	if !opts.yes {
		fmt.Printf("\nRemove %d match%s? (y/N) ", len(matches), matchPlural(len(matches)))
		if !confirm() {
			fmt.Println("\n👋 Aborted.")

			return 0
		}
	}

	fmt.Println("\n🗑️  Removing...")

	removed, failed := removeMatches(matches, opts.jobs)

	if failed == 0 {
		fmt.Printf("\n✨ Yeeted %d match%s!\n", removed, matchPlural(removed))

		return 0
	}

	fmt.Printf("\n⚠️  Removed %d/%d. Some failed — check errors above.\n", removed, len(matches))

	return 1
}

func matchPlural(n int) string {
	if n == 1 {
		return ""
	}

	return "es"
}

func plural2(n int) string {
	if n == 1 {
		return ""
	}

	return "s"
}

func matchIcon(isDir bool) string {
	if isDir {
		return "📁"
	}

	return "📄"
}

// isLinkedPath returns true if path resolves through a symlink/reparse-point
// to a different location. This catches regular symlinks and Windows junctions.
func isLinkedPath(path string) bool {
	info, err := os.Lstat(path)
	if err != nil {
		return false
	}

	if info.Mode()&os.ModeSymlink != 0 {
		return true
	}

	resolved, err := filepath.EvalSymlinks(path)
	if err != nil {
		return false
	}

	absPath, err := filepath.Abs(path)
	if err != nil {
		return false
	}

	absResolved, err := filepath.Abs(resolved)
	if err != nil {
		return false
	}

	cleanPath := filepath.Clean(absPath)
	cleanResolved := filepath.Clean(absResolved)

	if runtime.GOOS == "windows" {
		return !strings.EqualFold(cleanPath, cleanResolved)
	}

	return cleanPath != cleanResolved
}

// isGlob returns true if the pattern contains glob metacharacters.
func isGlob(pattern string) bool {
	return strings.ContainsAny(pattern, "*?[")
}

// matchesAny returns true if name matches any of the given glob patterns.
// Plain patterns (no glob syntax) use direct string comparison for speed.
func matchesAny(name string, patterns []string) bool {
	for _, p := range patterns {
		if isGlob(p) {
			if matched, _ := filepath.Match(p, name); matched {
				return true
			}
		} else if name == p {
			return true
		}
	}

	return false
}

// findMatches concurrently walks the directory tree to find all files and
// directories matching any of the given glob patterns. It uses a semaphore to
// bound concurrency and falls back to inline processing when all workers are
// busy, preventing deadlocks.
func findMatches(root string, patterns []string, exclude map[string]bool, jobs int, errw io.Writer) []match {
	var (
		mu    sync.Mutex
		found = make([]match, 0, 32)
		wg    sync.WaitGroup
		sem   = make(chan struct{}, jobs)
	)

	var walk func(dir string)
	walk = func(dir string) {
		defer wg.Done()

		entries, err := readDirUnsorted(dir)
		if err != nil {
			if errw != nil {
				fmt.Fprintf(errw, "  ⚠️  Could not scan %s: %v\n", dir, err)
			}

			return
		}

		for _, entry := range entries {
			name := entry.Name()
			fullPath := filepath.Join(dir, name)

			if entry.IsDir() {
				isLinkedDir := isLinkedPath(fullPath)

				if exclude[name] {
					continue
				}

				if matchesAny(name, patterns) {
					mu.Lock()
					found = append(found, match{path: fullPath, isDir: true})
					mu.Unlock()
				} else if isLinkedDir {
					continue
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
			} else if matchesAny(name, patterns) {
				mu.Lock()
				found = append(found, match{path: fullPath, isDir: false})
				mu.Unlock()
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

// getMatchSizes concurrently computes the size of each match. Directories use
// the concurrent tree-walking size computation. Files use a single stat call.
func getMatchSizes(matches []match, jobs int, errw io.Writer) []int64 {
	sizes := make([]int64, len(matches))

	var wg sync.WaitGroup
	sem := make(chan struct{}, jobs)

	for i, m := range matches {
		if m.isDir {
			wg.Add(1)

			go func(idx int, path string) {
				defer wg.Done()

				var total atomic.Int64
				getDirSize(path, sem, &total, errw)
				sizes[idx] = total.Load()
			}(i, m.path)
		} else {
			if info, err := os.Stat(m.path); err == nil {
				sizes[i] = info.Size()
			}
		}
	}

	wg.Wait()

	return sizes
}

// getDirSize concurrently computes total file size using the semaphore+select
// fallback pattern. Falls back to inline processing when all workers are busy,
// preventing deadlocks in recursive tree walks.
func getDirSize(path string, sem chan struct{}, total *atomic.Int64, errw io.Writer) {
	entries, err := readDirUnsorted(path)
	if err != nil {
		if errw != nil {
			fmt.Fprintf(errw, "  ⚠️  Could not read %s: %v\n", path, err)
		}

		return
	}

	var (
		wg   sync.WaitGroup
		size int64
	)

	for _, entry := range entries {
		if entry.IsDir() {
			child := filepath.Join(path, entry.Name())
			if isLinkedPath(child) {
				if info, err := os.Lstat(child); err == nil {
					size += info.Size()
				}

				continue
			}

			wg.Add(1)

			select {
			case sem <- struct{}{}:
				go func(p string) {
					defer wg.Done()
					defer func() { <-sem }()

					getDirSize(p, sem, total, errw)
				}(child)
			default:
				func() {
					defer wg.Done()
					getDirSize(child, sem, total, errw)
				}()
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
			if isLinkedPath(child) {
				files = append(files, child)

				continue
			}

			wg.Add(1)

			select {
			case sem <- struct{}{}:
				go func(p string) {
					defer wg.Done()
					defer func() { <-sem }()

					parallelRemoveAll(p, sem)
				}(child)
			default:
				func() {
					defer wg.Done()
					parallelRemoveAll(child, sem)
				}()
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
			func() {
				defer wg.Done()
				for _, p := range batch {
					os.Remove(p)
				}
			}()
		}
	}

	wg.Wait()

	return os.Remove(root)
}

// removeMatches deletes matches concurrently. Directories use parallelRemoveAll
// with a shared semaphore. Files use a simple os.Remove.
func removeMatches(matches []match, jobs int) (removed int, failed int) {
	var wg sync.WaitGroup
	var successCount atomic.Int32
	var failCount atomic.Int32

	// Shared semaphore across all directory trees for bounded I/O concurrency.
	sem := make(chan struct{}, jobs*4)

	for _, m := range matches {
		wg.Add(1)

		go func(m match) {
			defer wg.Done()

			var err error
			if m.isDir {
				if isLinkedPath(m.path) {
					err = os.Remove(m.path)
				} else {
					err = parallelRemoveAll(m.path, sem)
				}
			} else {
				err = os.Remove(m.path)
			}

			if err != nil {
				fmt.Fprintf(os.Stderr, "  ❌ %s: %v\n", m.path, err)
				failCount.Add(1)
			} else {
				fmt.Printf("  ✅ %s\n", m.path)
				successCount.Add(1)
			}
		}(m)
	}

	wg.Wait()

	return int(successCount.Load()), int(failCount.Load())
}
