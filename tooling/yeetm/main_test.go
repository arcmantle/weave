package main

import (
	"bytes"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"sync/atomic"
	"testing"
)

// createTestTree builds a synthetic directory tree for testing and benchmarking.
// Structure: depth levels of directories, each with the given number of
// subdirectories and files per directory.
func createTestTree(tb testing.TB, root string, depth, dirsPerLevel, filesPerDir int) {
	tb.Helper()

	if depth <= 0 {
		return
	}

	for i := range filesPerDir {
		name := filepath.Join(root, "file_"+itoa(i)+".js")
		os.WriteFile(name, make([]byte, 1024), 0o644)
	}

	for i := range dirsPerLevel {
		sub := filepath.Join(root, "dir_"+itoa(i))
		os.MkdirAll(sub, 0o755)
		createTestTree(tb, sub, depth-1, dirsPerLevel, filesPerDir)
	}
}

// itoa is a minimal int-to-string without importing strconv.
func itoa(n int) string {
	if n == 0 {
		return "0"
	}

	buf := [20]byte{}
	pos := len(buf)

	for n > 0 {
		pos--
		buf[pos] = byte('0' + n%10)
		n /= 10
	}

	return string(buf[pos:])
}

// mkNodeModules creates node_modules directories at the given project paths
// with a dummy file inside each.
func mkNodeModules(t *testing.T, root string, projects []string) {
	t.Helper()

	for _, p := range projects {
		nm := filepath.Join(root, p, "node_modules")
		if err := os.MkdirAll(nm, 0o755); err != nil {
			t.Fatal(err)
		}

		os.WriteFile(filepath.Join(nm, "package.json"), []byte("{}"), 0o644)
	}
}

// --- Functional Tests: findNodeModules ---

func TestFindNodeModulesBasic(t *testing.T) {
	root := t.TempDir()
	projects := []string{"app", "lib", "tools"}
	mkNodeModules(t, root, projects)

	dirs := findNodeModules(root, map[string]bool{".git": true}, 4, nil)
	sort.Strings(dirs)

	if len(dirs) != len(projects) {
		t.Fatalf("expected %d dirs, got %d", len(projects), len(dirs))
	}

	sort.Strings(projects)
	for i, p := range projects {
		expected := filepath.Join(root, p, "node_modules")
		if dirs[i] != expected {
			t.Errorf("dirs[%d] = %q, want %q", i, dirs[i], expected)
		}
	}
}

func TestFindNodeModulesNested(t *testing.T) {
	root := t.TempDir()
	projects := []string{"packages/core", "packages/ui"}
	mkNodeModules(t, root, projects)

	dirs := findNodeModules(root, map[string]bool{".git": true}, 4, nil)

	if len(dirs) != 2 {
		t.Fatalf("expected 2 dirs, got %d: %v", len(dirs), dirs)
	}
}

func TestFindNodeModulesDoesNotRecurseIntoNodeModules(t *testing.T) {
	root := t.TempDir()

	// Create node_modules with a nested node_modules inside.
	outer := filepath.Join(root, "app", "node_modules")
	inner := filepath.Join(outer, "some-package", "node_modules")
	os.MkdirAll(inner, 0o755)
	os.WriteFile(filepath.Join(inner, "index.js"), []byte("x"), 0o644)

	dirs := findNodeModules(root, map[string]bool{".git": true}, 4, nil)

	if len(dirs) != 1 {
		t.Fatalf("expected 1 dir (should not recurse into node_modules), got %d: %v", len(dirs), dirs)
	}

	if dirs[0] != outer {
		t.Errorf("got %q, want %q", dirs[0], outer)
	}
}

func TestFindNodeModulesExclude(t *testing.T) {
	root := t.TempDir()
	mkNodeModules(t, root, []string{"app", "vendor"})

	exclude := map[string]bool{".git": true, "vendor": true}
	dirs := findNodeModules(root, exclude, 4, nil)

	if len(dirs) != 1 {
		t.Fatalf("expected 1 dir (vendor excluded), got %d: %v", len(dirs), dirs)
	}

	expected := filepath.Join(root, "app", "node_modules")
	if dirs[0] != expected {
		t.Errorf("got %q, want %q", dirs[0], expected)
	}
}

func TestFindNodeModulesGitExcludedByDefault(t *testing.T) {
	root := t.TempDir()

	// Create a .git directory with a node_modules inside.
	gitNM := filepath.Join(root, ".git", "node_modules")
	os.MkdirAll(gitNM, 0o755)

	// Also create a normal one.
	mkNodeModules(t, root, []string{"app"})

	dirs := findNodeModules(root, buildExcludeSet(nil), 4, nil)

	if len(dirs) != 1 {
		t.Fatalf("expected 1 dir (.git excluded), got %d: %v", len(dirs), dirs)
	}
}

func TestFindNodeModulesEmpty(t *testing.T) {
	root := t.TempDir()
	dirs := findNodeModules(root, map[string]bool{".git": true}, 4, nil)

	if len(dirs) != 0 {
		t.Fatalf("expected 0 dirs, got %d", len(dirs))
	}
}

func TestFindNodeModulesErrorLogging(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("directory permissions work differently on Windows")
	}

	root := t.TempDir()
	mkNodeModules(t, root, []string{"app"})

	// Create a directory we can't read.
	unreadable := filepath.Join(root, "locked")
	os.MkdirAll(unreadable, 0o755)
	os.Chmod(unreadable, 0o000)
	t.Cleanup(func() { os.Chmod(unreadable, 0o755) })

	var buf bytes.Buffer
	dirs := findNodeModules(root, map[string]bool{".git": true}, 4, &buf)

	// Should still find the one we can access.
	if len(dirs) != 1 {
		t.Fatalf("expected 1 dir, got %d", len(dirs))
	}

	// The error should have been logged.
	if buf.Len() == 0 {
		t.Error("expected error to be logged for unreadable directory")
	}
}

func TestFindNodeModulesNoErrorLogWithoutWriter(t *testing.T) {
	root := t.TempDir()

	// With nil errw, errors are silently ignored (no panic, no crash).
	dirs := findNodeModules(root, map[string]bool{".git": true}, 4, nil)

	if len(dirs) != 0 {
		t.Fatalf("expected 0 dirs, got %d", len(dirs))
	}
}

func TestFindNodeModulesMultipleExcludes(t *testing.T) {
	root := t.TempDir()
	mkNodeModules(t, root, []string{"app", "vendor", "dist", "build"})

	exclude := buildExcludeSet([]string{"vendor", "dist", "build"})
	dirs := findNodeModules(root, exclude, 4, nil)

	if len(dirs) != 1 {
		t.Fatalf("expected 1 dir, got %d: %v", len(dirs), dirs)
	}
}

// --- Functional Tests: formatBytes ---

func TestFormatBytes(t *testing.T) {
	tests := []struct {
		input    int64
		expected string
	}{
		{0, "0 B"},
		{1, "1.00 B"},
		{512, "512.00 B"},
		{1023, "1023.00 B"},
		{1024, "1.00 KB"},
		{1536, "1.50 KB"},
		{1048576, "1.00 MB"},
		{1073741824, "1.00 GB"},
		{1099511627776, "1.00 TB"},
		{5368709120, "5.00 GB"},
		{2621440, "2.50 MB"},
	}

	for _, tt := range tests {
		got := formatBytes(tt.input)
		if got != tt.expected {
			t.Errorf("formatBytes(%d) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}

// --- Functional Tests: buildExcludeSet ---

func TestBuildExcludeSet(t *testing.T) {
	set := buildExcludeSet(nil)

	if !set[".git"] {
		t.Error(".git should be excluded by default")
	}

	if set["vendor"] {
		t.Error("vendor should not be excluded by default")
	}
}

func TestBuildExcludeSetCustom(t *testing.T) {
	set := buildExcludeSet([]string{"vendor", "dist"})

	if !set[".git"] {
		t.Error(".git should still be excluded")
	}

	if !set["vendor"] {
		t.Error("vendor should be excluded")
	}

	if !set["dist"] {
		t.Error("dist should be excluded")
	}
}

// --- Functional Tests: getDirSizes / getDirSize ---

func TestGetDirSizes(t *testing.T) {
	root := t.TempDir()

	dir1 := filepath.Join(root, "a")
	dir2 := filepath.Join(root, "b")
	os.MkdirAll(dir1, 0o755)
	os.MkdirAll(dir2, 0o755)

	os.WriteFile(filepath.Join(dir1, "f1.txt"), make([]byte, 1000), 0o644)
	os.WriteFile(filepath.Join(dir1, "f2.txt"), make([]byte, 2000), 0o644)
	os.WriteFile(filepath.Join(dir2, "f1.txt"), make([]byte, 500), 0o644)

	sizes := getDirSizes([]string{dir1, dir2}, 4, nil)

	if sizes[0] != 3000 {
		t.Errorf("dir1 size = %d, want 3000", sizes[0])
	}

	if sizes[1] != 500 {
		t.Errorf("dir2 size = %d, want 500", sizes[1])
	}
}

func TestGetDirSizesNested(t *testing.T) {
	root := t.TempDir()

	sub := filepath.Join(root, "sub")
	os.MkdirAll(sub, 0o755)

	os.WriteFile(filepath.Join(root, "f1.txt"), make([]byte, 100), 0o644)
	os.WriteFile(filepath.Join(sub, "f2.txt"), make([]byte, 200), 0o644)

	sizes := getDirSizes([]string{root}, 4, nil)

	if sizes[0] != 300 {
		t.Errorf("total size = %d, want 300", sizes[0])
	}
}

func TestGetDirSizesEmpty(t *testing.T) {
	root := t.TempDir()

	sizes := getDirSizes([]string{root}, 4, nil)

	if sizes[0] != 0 {
		t.Errorf("empty dir size = %d, want 0", sizes[0])
	}
}

func TestGetDirSizesErrorLogging(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("directory permissions work differently on Windows")
	}

	root := t.TempDir()
	os.WriteFile(filepath.Join(root, "f.txt"), make([]byte, 100), 0o644)

	unreadable := filepath.Join(root, "locked")
	os.MkdirAll(unreadable, 0o755)
	os.WriteFile(filepath.Join(unreadable, "secret.txt"), make([]byte, 500), 0o644)
	os.Chmod(unreadable, 0o000)
	t.Cleanup(func() { os.Chmod(unreadable, 0o755) })

	var buf bytes.Buffer
	sizes := getDirSizes([]string{root}, 4, &buf)

	// Should still count the accessible file.
	if sizes[0] != 100 {
		t.Errorf("size = %d, want 100 (only accessible files)", sizes[0])
	}

	if buf.Len() == 0 {
		t.Error("expected error to be logged for unreadable subdirectory")
	}
}

// --- Functional Tests: readDirUnsorted ---

func TestReadDirUnsorted(t *testing.T) {
	root := t.TempDir()
	os.WriteFile(filepath.Join(root, "a.txt"), []byte("a"), 0o644)
	os.WriteFile(filepath.Join(root, "b.txt"), []byte("b"), 0o644)
	os.MkdirAll(filepath.Join(root, "c"), 0o755)

	entries, err := readDirUnsorted(root)
	if err != nil {
		t.Fatal(err)
	}

	if len(entries) != 3 {
		t.Fatalf("expected 3 entries, got %d", len(entries))
	}
}

func TestReadDirUnsortedEmpty(t *testing.T) {
	root := t.TempDir()

	entries, err := readDirUnsorted(root)
	if err != nil {
		t.Fatal(err)
	}

	if len(entries) != 0 {
		t.Fatalf("expected 0 entries, got %d", len(entries))
	}
}

func TestReadDirUnsortedNonExistent(t *testing.T) {
	_, err := readDirUnsorted(filepath.Join(t.TempDir(), "nonexistent"))

	if err == nil {
		t.Error("expected error for nonexistent directory")
	}
}

// --- Functional Tests: parallelRemoveAll ---

func TestParallelRemoveAll(t *testing.T) {
	root := t.TempDir()
	target := filepath.Join(root, "nm")
	os.MkdirAll(target, 0o755)

	createTestTree(t, target, 3, 3, 5)

	sem := make(chan struct{}, 8)
	err := parallelRemoveAll(target, sem)

	if err != nil {
		t.Fatalf("parallelRemoveAll failed: %v", err)
	}

	if _, err := os.Stat(target); !os.IsNotExist(err) {
		t.Error("target directory should have been removed")
	}
}

func TestParallelRemoveAllEmptyDir(t *testing.T) {
	root := t.TempDir()
	target := filepath.Join(root, "empty")
	os.MkdirAll(target, 0o755)

	sem := make(chan struct{}, 4)
	err := parallelRemoveAll(target, sem)

	if err != nil {
		t.Fatalf("parallelRemoveAll failed on empty dir: %v", err)
	}

	if _, err := os.Stat(target); !os.IsNotExist(err) {
		t.Error("directory should have been removed")
	}
}

func TestParallelRemoveAllSingleFile(t *testing.T) {
	root := t.TempDir()
	target := filepath.Join(root, "nm")
	os.MkdirAll(target, 0o755)
	os.WriteFile(filepath.Join(target, "index.js"), []byte("x"), 0o644)

	sem := make(chan struct{}, 4)
	err := parallelRemoveAll(target, sem)

	if err != nil {
		t.Fatalf("parallelRemoveAll failed: %v", err)
	}

	if _, err := os.Stat(target); !os.IsNotExist(err) {
		t.Error("target directory should have been removed")
	}
}

func TestParallelRemoveAllDeep(t *testing.T) {
	root := t.TempDir()
	target := filepath.Join(root, "nm")
	os.MkdirAll(target, 0o755)

	// Deep tree: 5 levels, 2 dirs each, 3 files each.
	createTestTree(t, target, 5, 2, 3)

	sem := make(chan struct{}, 4)
	err := parallelRemoveAll(target, sem)

	if err != nil {
		t.Fatalf("parallelRemoveAll failed: %v", err)
	}

	if _, err := os.Stat(target); !os.IsNotExist(err) {
		t.Error("target directory should have been removed")
	}
}

func TestParallelRemoveAllManyFiles(t *testing.T) {
	root := t.TempDir()
	target := filepath.Join(root, "nm")
	os.MkdirAll(target, 0o755)

	// Create more than batchSize (128) files to test batching logic.
	for i := range 200 {
		os.WriteFile(filepath.Join(target, "file_"+itoa(i)+".js"), []byte("x"), 0o644)
	}

	sem := make(chan struct{}, 4)
	err := parallelRemoveAll(target, sem)

	if err != nil {
		t.Fatalf("parallelRemoveAll failed: %v", err)
	}

	if _, err := os.Stat(target); !os.IsNotExist(err) {
		t.Error("target directory should have been removed")
	}
}

// --- Functional Tests: removeDirs ---

func TestRemoveDirs(t *testing.T) {
	root := t.TempDir()
	dirs := make([]string, 3)

	for i := range dirs {
		d := filepath.Join(root, "nm_"+itoa(i))
		os.MkdirAll(d, 0o755)
		os.WriteFile(filepath.Join(d, "f.txt"), []byte("x"), 0o644)
		dirs[i] = d
	}

	removed, failed := removeDirs(dirs, 4)

	if removed != 3 {
		t.Errorf("removed = %d, want 3", removed)
	}

	if failed != 0 {
		t.Errorf("failed = %d, want 0", failed)
	}

	for _, d := range dirs {
		if _, err := os.Stat(d); !os.IsNotExist(err) {
			t.Errorf("directory %q should have been removed", d)
		}
	}
}

func TestRemoveDirsNonExistent(t *testing.T) {
	root := t.TempDir()
	dirs := []string{filepath.Join(root, "nonexistent")}

	removed, failed := removeDirs(dirs, 4)

	if removed != 0 {
		t.Errorf("removed = %d, want 0", removed)
	}

	if failed != 1 {
		t.Errorf("failed = %d, want 1", failed)
	}
}

// --- Functional Tests: run() ---

func TestRunDryRun(t *testing.T) {
	root := t.TempDir()
	mkNodeModules(t, root, []string{"app", "lib"})

	code := run(options{
		targetDir: root,
		dryRun:    true,
		yes:       true,
		jobs:      4,
		exclude:   buildExcludeSet(nil),
	})

	if code != 0 {
		t.Errorf("exit code = %d, want 0", code)
	}

	// node_modules should still exist.
	for _, p := range []string{"app", "lib"} {
		nm := filepath.Join(root, p, "node_modules")
		if _, err := os.Stat(nm); os.IsNotExist(err) {
			t.Errorf("%s should still exist after dry run", nm)
		}
	}
}

func TestRunYes(t *testing.T) {
	root := t.TempDir()
	mkNodeModules(t, root, []string{"app"})

	code := run(options{
		targetDir: root,
		yes:       true,
		jobs:      4,
		exclude:   buildExcludeSet(nil),
	})

	if code != 0 {
		t.Errorf("exit code = %d, want 0", code)
	}

	nm := filepath.Join(root, "app", "node_modules")
	if _, err := os.Stat(nm); !os.IsNotExist(err) {
		t.Error("node_modules should have been removed")
	}
}

func TestRunNoModules(t *testing.T) {
	root := t.TempDir()

	code := run(options{
		targetDir: root,
		yes:       true,
		jobs:      4,
		exclude:   buildExcludeSet(nil),
	})

	if code != 0 {
		t.Errorf("exit code = %d, want 0", code)
	}
}

func TestRunVerbose(t *testing.T) {
	root := t.TempDir()
	mkNodeModules(t, root, []string{"app"})

	code := run(options{
		targetDir: root,
		verbose:   true,
		yes:       true,
		jobs:      4,
		exclude:   buildExcludeSet(nil),
	})

	if code != 0 {
		t.Errorf("exit code = %d, want 0", code)
	}
}

func TestRunVerboseDryRun(t *testing.T) {
	root := t.TempDir()
	mkNodeModules(t, root, []string{"app", "lib"})

	code := run(options{
		targetDir: root,
		verbose:   true,
		dryRun:    true,
		yes:       true,
		jobs:      4,
		exclude:   buildExcludeSet(nil),
	})

	if code != 0 {
		t.Errorf("exit code = %d, want 0", code)
	}

	// Should still exist after dry run.
	nm := filepath.Join(root, "app", "node_modules")
	if _, err := os.Stat(nm); os.IsNotExist(err) {
		t.Error("node_modules should still exist after dry run")
	}
}

func TestRunMultipleProjects(t *testing.T) {
	root := t.TempDir()
	projects := []string{"app", "lib", "tools", "packages/core", "packages/ui"}
	mkNodeModules(t, root, projects)

	code := run(options{
		targetDir: root,
		yes:       true,
		jobs:      4,
		exclude:   buildExcludeSet(nil),
	})

	if code != 0 {
		t.Errorf("exit code = %d, want 0", code)
	}

	for _, p := range projects {
		nm := filepath.Join(root, p, "node_modules")
		if _, err := os.Stat(nm); !os.IsNotExist(err) {
			t.Errorf("%s should have been removed", nm)
		}
	}
}

func TestRunWithExcludes(t *testing.T) {
	root := t.TempDir()
	mkNodeModules(t, root, []string{"app", "vendor"})

	code := run(options{
		targetDir: root,
		yes:       true,
		jobs:      4,
		exclude:   buildExcludeSet([]string{"vendor"}),
	})

	if code != 0 {
		t.Errorf("exit code = %d, want 0", code)
	}

	// app/node_modules should be removed.
	appNM := filepath.Join(root, "app", "node_modules")
	if _, err := os.Stat(appNM); !os.IsNotExist(err) {
		t.Error("app/node_modules should have been removed")
	}

	// vendor/node_modules should still exist (excluded).
	vendorNM := filepath.Join(root, "vendor", "node_modules")
	if _, err := os.Stat(vendorNM); os.IsNotExist(err) {
		t.Error("vendor/node_modules should still exist (excluded)")
	}
}

// --- Functional Tests: stringSlice ---

func TestStringSlice(t *testing.T) {
	var s stringSlice
	s.Set("a")
	s.Set("b")
	s.Set("c")

	if len(s) != 3 {
		t.Fatalf("len = %d, want 3", len(s))
	}

	str := s.String()
	if str != "a, b, c" {
		t.Errorf("String() = %q, want %q", str, "a, b, c")
	}
}

func TestStringSliceEmpty(t *testing.T) {
	var s stringSlice

	if s.String() != "" {
		t.Errorf("String() = %q, want empty", s.String())
	}
}

func TestStringSliceSingle(t *testing.T) {
	var s stringSlice
	s.Set("only")

	if s.String() != "only" {
		t.Errorf("String() = %q, want %q", s.String(), "only")
	}
}

// --- Benchmarks ---

func BenchmarkFindNodeModules(b *testing.B) {
	root := b.TempDir()

	// Create 5 node_modules directories scattered in a tree.
	projects := []string{"app", "lib", "tools", "packages/core", "packages/ui"}
	for _, p := range projects {
		nm := filepath.Join(root, p, "node_modules")
		os.MkdirAll(nm, 0o755)
		createTestTree(b, nm, 2, 3, 5)
	}

	exclude := map[string]bool{".git": true}

	b.ResetTimer()

	for range b.N {
		dirs := findNodeModules(root, exclude, 4, nil)
		if len(dirs) != len(projects) {
			b.Fatalf("expected %d dirs, got %d", len(projects), len(dirs))
		}
	}
}

func BenchmarkGetDirSize(b *testing.B) {
	root := b.TempDir()

	// ~3^4 = 81 dirs, each with 10 files = ~810 files + dirs.
	createTestTree(b, root, 4, 3, 10)

	sem := make(chan struct{}, 4)

	b.ResetTimer()

	for range b.N {
		var total atomic.Int64
		getDirSize(root, sem, &total, nil)

		if total.Load() == 0 {
			b.Fatal("expected non-zero size")
		}
	}
}

func BenchmarkGetDirSizes(b *testing.B) {
	root := b.TempDir()

	// Create 3 independent trees to measure cross-tree parallelism.
	dirs := make([]string, 3)
	for i := range dirs {
		d := filepath.Join(root, "tree_"+itoa(i))
		os.MkdirAll(d, 0o755)
		createTestTree(b, d, 4, 3, 10)
		dirs[i] = d
	}

	b.ResetTimer()

	for range b.N {
		sizes := getDirSizes(dirs, 4, nil)
		for i, s := range sizes {
			if s == 0 {
				b.Fatalf("tree %d returned zero size", i)
			}
		}
	}
}

func BenchmarkReadDirUnsorted(b *testing.B) {
	root := b.TempDir()

	// Create a directory with many entries.
	for i := range 200 {
		os.WriteFile(filepath.Join(root, "file_"+itoa(i)+".txt"), []byte("x"), 0o644)
	}
	for i := range 50 {
		os.MkdirAll(filepath.Join(root, "dir_"+itoa(i)), 0o755)
	}

	b.ResetTimer()

	for range b.N {
		entries, err := readDirUnsorted(root)
		if err != nil {
			b.Fatal(err)
		}

		if len(entries) != 250 {
			b.Fatalf("expected 250 entries, got %d", len(entries))
		}
	}
}

func BenchmarkParallelRemoveAll(b *testing.B) {
	for range b.N {
		b.StopTimer()

		root := b.TempDir()
		target := filepath.Join(root, "nm")
		os.MkdirAll(target, 0o755)
		createTestTree(b, target, 3, 4, 15)
		sem := make(chan struct{}, 8)

		b.StartTimer()

		parallelRemoveAll(target, sem)
	}
}
