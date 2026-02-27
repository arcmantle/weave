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

// --- Functional Tests: findMatches ---

var defaultPatterns = []string{"node_modules"}

// matchPaths extracts sorted paths from a slice of matches.
func matchPaths(matches []match) []string {
	paths := make([]string, len(matches))
	for i, m := range matches {
		paths[i] = m.path
	}

	sort.Strings(paths)

	return paths
}

func TestFindMatchesBasic(t *testing.T) {
	root := t.TempDir()
	projects := []string{"app", "lib", "tools"}
	mkNodeModules(t, root, projects)

	matches := findMatches(root, defaultPatterns, map[string]bool{".git": true}, 4, nil)
	paths := matchPaths(matches)

	if len(paths) != len(projects) {
		t.Fatalf("expected %d matches, got %d", len(projects), len(paths))
	}

	sort.Strings(projects)
	for i, p := range projects {
		expected := filepath.Join(root, p, "node_modules")
		if paths[i] != expected {
			t.Errorf("paths[%d] = %q, want %q", i, paths[i], expected)
		}
	}

	for _, m := range matches {
		if !m.isDir {
			t.Errorf("%q should be a directory match", m.path)
		}
	}
}

func TestFindMatchesNested(t *testing.T) {
	root := t.TempDir()
	projects := []string{"packages/core", "packages/ui"}
	mkNodeModules(t, root, projects)

	matches := findMatches(root, defaultPatterns, map[string]bool{".git": true}, 4, nil)

	if len(matches) != 2 {
		t.Fatalf("expected 2 matches, got %d: %v", len(matches), matchPaths(matches))
	}
}

func TestFindMatchesDoesNotRecurseIntoMatch(t *testing.T) {
	root := t.TempDir()

	// Create node_modules with a nested node_modules inside.
	outer := filepath.Join(root, "app", "node_modules")
	inner := filepath.Join(outer, "some-package", "node_modules")
	os.MkdirAll(inner, 0o755)
	os.WriteFile(filepath.Join(inner, "index.js"), []byte("x"), 0o644)

	matches := findMatches(root, defaultPatterns, map[string]bool{".git": true}, 4, nil)

	if len(matches) != 1 {
		t.Fatalf("expected 1 match (should not recurse into match), got %d: %v", len(matches), matchPaths(matches))
	}

	if matches[0].path != outer {
		t.Errorf("got %q, want %q", matches[0].path, outer)
	}
}

func TestFindMatchesExclude(t *testing.T) {
	root := t.TempDir()
	mkNodeModules(t, root, []string{"app", "vendor"})

	exclude := map[string]bool{".git": true, "vendor": true}
	matches := findMatches(root, defaultPatterns, exclude, 4, nil)

	if len(matches) != 1 {
		t.Fatalf("expected 1 match (vendor excluded), got %d: %v", len(matches), matchPaths(matches))
	}

	expected := filepath.Join(root, "app", "node_modules")
	if matches[0].path != expected {
		t.Errorf("got %q, want %q", matches[0].path, expected)
	}
}

func TestFindMatchesGitExcludedByDefault(t *testing.T) {
	root := t.TempDir()

	// Create a .git directory with a node_modules inside.
	gitNM := filepath.Join(root, ".git", "node_modules")
	os.MkdirAll(gitNM, 0o755)

	// Also create a normal one.
	mkNodeModules(t, root, []string{"app"})

	matches := findMatches(root, defaultPatterns, buildExcludeSet(nil), 4, nil)

	if len(matches) != 1 {
		t.Fatalf("expected 1 match (.git excluded), got %d: %v", len(matches), matchPaths(matches))
	}
}

func TestFindMatchesEmpty(t *testing.T) {
	root := t.TempDir()
	matches := findMatches(root, defaultPatterns, map[string]bool{".git": true}, 4, nil)

	if len(matches) != 0 {
		t.Fatalf("expected 0 matches, got %d", len(matches))
	}
}

func TestFindMatchesErrorLogging(t *testing.T) {
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
	matches := findMatches(root, defaultPatterns, map[string]bool{".git": true}, 4, &buf)

	// Should still find the one we can access.
	if len(matches) != 1 {
		t.Fatalf("expected 1 match, got %d", len(matches))
	}

	// The error should have been logged.
	if buf.Len() == 0 {
		t.Error("expected error to be logged for unreadable directory")
	}
}

func TestFindMatchesNoErrorLogWithoutWriter(t *testing.T) {
	root := t.TempDir()

	// With nil errw, errors are silently ignored (no panic, no crash).
	matches := findMatches(root, defaultPatterns, map[string]bool{".git": true}, 4, nil)

	if len(matches) != 0 {
		t.Fatalf("expected 0 matches, got %d", len(matches))
	}
}

func TestFindMatchesMultipleExcludes(t *testing.T) {
	root := t.TempDir()
	mkNodeModules(t, root, []string{"app", "vendor", "dist", "build"})

	exclude := buildExcludeSet([]string{"vendor", "dist", "build"})
	matches := findMatches(root, defaultPatterns, exclude, 4, nil)

	if len(matches) != 1 {
		t.Fatalf("expected 1 match, got %d: %v", len(matches), matchPaths(matches))
	}
}

func TestFindMatchesCustomPattern(t *testing.T) {
	root := t.TempDir()

	// Create dist directories instead of node_modules.
	for _, p := range []string{"app", "lib"} {
		d := filepath.Join(root, p, "dist")
		os.MkdirAll(d, 0o755)
		os.WriteFile(filepath.Join(d, "bundle.js"), []byte("x"), 0o644)
	}

	matches := findMatches(root, []string{"dist"}, map[string]bool{".git": true}, 4, nil)
	paths := matchPaths(matches)

	if len(paths) != 2 {
		t.Fatalf("expected 2 matches, got %d: %v", len(paths), paths)
	}
}

func TestFindMatchesMultiplePatterns(t *testing.T) {
	root := t.TempDir()

	// Create both node_modules and dist directories.
	os.MkdirAll(filepath.Join(root, "app", "node_modules"), 0o755)
	os.MkdirAll(filepath.Join(root, "app", "dist"), 0o755)
	os.MkdirAll(filepath.Join(root, "lib", "dist"), 0o755)

	matches := findMatches(root, []string{"node_modules", "dist"}, map[string]bool{".git": true}, 4, nil)

	if len(matches) != 3 {
		t.Fatalf("expected 3 matches, got %d: %v", len(matches), matchPaths(matches))
	}
}

func TestFindMatchesGlobWildcard(t *testing.T) {
	root := t.TempDir()

	// Create directories matching a wildcard pattern.
	os.MkdirAll(filepath.Join(root, "app", ".cache"), 0o755)
	os.MkdirAll(filepath.Join(root, "lib", ".cached"), 0o755)
	os.MkdirAll(filepath.Join(root, "tools", "cache"), 0o755)

	matches := findMatches(root, []string{".cache*"}, map[string]bool{".git": true}, 4, nil)
	paths := matchPaths(matches)

	if len(paths) != 2 {
		t.Fatalf("expected 2 matches (.cache and .cached), got %d: %v", len(paths), paths)
	}
}

func TestFindMatchesFiles(t *testing.T) {
	root := t.TempDir()

	// Create files matching a glob pattern.
	os.MkdirAll(filepath.Join(root, "app"), 0o755)
	os.MkdirAll(filepath.Join(root, "lib"), 0o755)
	os.WriteFile(filepath.Join(root, "app", "debug.log"), []byte("log1"), 0o644)
	os.WriteFile(filepath.Join(root, "lib", "error.log"), []byte("log2"), 0o644)
	os.WriteFile(filepath.Join(root, "app", "main.go"), []byte("code"), 0o644)

	matches := findMatches(root, []string{"*.log"}, map[string]bool{".git": true}, 4, nil)
	paths := matchPaths(matches)

	if len(paths) != 2 {
		t.Fatalf("expected 2 file matches, got %d: %v", len(paths), paths)
	}

	for _, m := range matches {
		if m.isDir {
			t.Errorf("%q should be a file match, not dir", m.path)
		}
	}
}

func TestFindMatchesMixedFilesAndDirs(t *testing.T) {
	root := t.TempDir()

	// Create both a directory and file that match different patterns.
	os.MkdirAll(filepath.Join(root, "app", "node_modules"), 0o755)
	os.WriteFile(filepath.Join(root, "app", "debug.log"), []byte("log"), 0o644)

	matches := findMatches(root, []string{"node_modules", "*.log"}, map[string]bool{".git": true}, 4, nil)

	if len(matches) != 2 {
		t.Fatalf("expected 2 matches (1 dir + 1 file), got %d: %v", len(matches), matchPaths(matches))
	}

	var dirs, files int
	for _, m := range matches {
		if m.isDir {
			dirs++
		} else {
			files++
		}
	}

	if dirs != 1 || files != 1 {
		t.Errorf("expected 1 dir + 1 file, got %d dirs + %d files", dirs, files)
	}
}

func TestFindMatchesFileExactName(t *testing.T) {
	root := t.TempDir()

	// Match files by exact name (no glob).
	os.MkdirAll(filepath.Join(root, "a"), 0o755)
	os.MkdirAll(filepath.Join(root, "b"), 0o755)
	os.WriteFile(filepath.Join(root, "a", ".DS_Store"), []byte("x"), 0o644)
	os.WriteFile(filepath.Join(root, "b", ".DS_Store"), []byte("x"), 0o644)
	os.WriteFile(filepath.Join(root, "b", "keep.txt"), []byte("x"), 0o644)

	matches := findMatches(root, []string{".DS_Store"}, map[string]bool{".git": true}, 4, nil)

	if len(matches) != 2 {
		t.Fatalf("expected 2 matches, got %d: %v", len(matches), matchPaths(matches))
	}

	for _, m := range matches {
		if m.isDir {
			t.Errorf("%q should be a file match", m.path)
		}
	}
}

func TestMatchesAny(t *testing.T) {
	tests := []struct {
		name     string
		patterns []string
		want     bool
	}{
		{"node_modules", []string{"node_modules"}, true},
		{"dist", []string{"node_modules"}, false},
		{"dist", []string{"node_modules", "dist"}, true},
		{".cache", []string{".cache*"}, true},
		{".cached", []string{".cache*"}, true},
		{"cache", []string{".cache*"}, false},
		{"build-output", []string{"build*"}, true},
		{"my-build", []string{"build*"}, false},
	}

	for _, tt := range tests {
		got := matchesAny(tt.name, tt.patterns)
		if got != tt.want {
			t.Errorf("matchesAny(%q, %v) = %v, want %v", tt.name, tt.patterns, got, tt.want)
		}
	}
}

func TestIsGlob(t *testing.T) {
	tests := []struct {
		pattern string
		want    bool
	}{
		{"node_modules", false},
		{"dist", false},
		{".cache", false},
		{".cache*", true},
		{"build-*", true},
		{"dist?", true},
		{"[abc]", true},
		{"node_modules*", true},
		{"plain-name", false},
	}

	for _, tt := range tests {
		got := isGlob(tt.pattern)
		if got != tt.want {
			t.Errorf("isGlob(%q) = %v, want %v", tt.pattern, got, tt.want)
		}
	}
}

func TestRunCustomPattern(t *testing.T) {
	root := t.TempDir()

	for _, p := range []string{"app", "lib"} {
		d := filepath.Join(root, p, "dist")
		os.MkdirAll(d, 0o755)
		os.WriteFile(filepath.Join(d, "bundle.js"), []byte("x"), 0o644)
	}

	code := run(options{
		targetDir: root,
		patterns:  []string{"dist"},
		yes:       true,
		jobs:      4,
		exclude:   buildExcludeSet(nil),
	})

	if code != 0 {
		t.Errorf("exit code = %d, want 0", code)
	}

	for _, p := range []string{"app", "lib"} {
		d := filepath.Join(root, p, "dist")
		if _, err := os.Stat(d); !os.IsNotExist(err) {
			t.Errorf("%s should have been removed", d)
		}
	}
}

func TestRunMultiplePatterns(t *testing.T) {
	root := t.TempDir()

	os.MkdirAll(filepath.Join(root, "app", "node_modules"), 0o755)
	os.MkdirAll(filepath.Join(root, "app", "dist"), 0o755)

	code := run(options{
		targetDir: root,
		patterns:  []string{"node_modules", "dist"},
		yes:       true,
		jobs:      4,
		exclude:   buildExcludeSet(nil),
	})

	if code != 0 {
		t.Errorf("exit code = %d, want 0", code)
	}

	for _, name := range []string{"node_modules", "dist"} {
		d := filepath.Join(root, "app", name)
		if _, err := os.Stat(d); !os.IsNotExist(err) {
			t.Errorf("%s should have been removed", d)
		}
	}
}

func TestMatchPlural(t *testing.T) {
	tests := []struct {
		n    int
		want string
	}{
		{0, "es"},
		{1, ""},
		{2, "es"},
		{10, "es"},
	}

	for _, tt := range tests {
		got := matchPlural(tt.n)
		if got != tt.want {
			t.Errorf("matchPlural(%d) = %q, want %q", tt.n, got, tt.want)
		}
	}
}

func TestMatchIcon(t *testing.T) {
	if matchIcon(true) != "📁" {
		t.Error("dir icon should be \U0001f4c1")
	}

	if matchIcon(false) != "📄" {
		t.Error("file icon should be \U0001f4c4")
	}
}

func TestRunFileGlob(t *testing.T) {
	root := t.TempDir()

	os.MkdirAll(filepath.Join(root, "app"), 0o755)
	os.MkdirAll(filepath.Join(root, "lib"), 0o755)
	os.WriteFile(filepath.Join(root, "app", "debug.log"), []byte("log1"), 0o644)
	os.WriteFile(filepath.Join(root, "lib", "error.log"), []byte("log2"), 0o644)
	os.WriteFile(filepath.Join(root, "app", "main.go"), []byte("code"), 0o644)

	code := run(options{
		targetDir: root,
		patterns:  []string{"*.log"},
		yes:       true,
		jobs:      4,
		exclude:   buildExcludeSet(nil),
	})

	if code != 0 {
		t.Errorf("exit code = %d, want 0", code)
	}

	// .log files should be removed.
	for _, f := range []string{"app/debug.log", "lib/error.log"} {
		p := filepath.Join(root, f)
		if _, err := os.Stat(p); !os.IsNotExist(err) {
			t.Errorf("%s should have been removed", p)
		}
	}

	// .go file should still exist.
	p := filepath.Join(root, "app", "main.go")
	if _, err := os.Stat(p); os.IsNotExist(err) {
		t.Error("main.go should still exist")
	}
}

func TestRunMixedDirsAndFiles(t *testing.T) {
	root := t.TempDir()

	os.MkdirAll(filepath.Join(root, "app", "node_modules"), 0o755)
	os.WriteFile(filepath.Join(root, "app", "node_modules", "pkg.json"), []byte("{}"), 0o644)
	os.WriteFile(filepath.Join(root, "app", ".DS_Store"), []byte("x"), 0o644)

	code := run(options{
		targetDir: root,
		patterns:  []string{"node_modules", ".DS_Store"},
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

	ds := filepath.Join(root, "app", ".DS_Store")
	if _, err := os.Stat(ds); !os.IsNotExist(err) {
		t.Error(".DS_Store should have been removed")
	}
}

func TestPatternLabel(t *testing.T) {
	tests := []struct {
		patterns []string
		want     string
	}{
		{[]string{"node_modules"}, "node_modules"},
		{[]string{"node_modules", "dist"}, "node_modules, dist"},
		{[]string{"dist", ".cache", "build"}, "dist, .cache, build"},
	}

	for _, tt := range tests {
		got := patternLabel(tt.patterns)
		if got != tt.want {
			t.Errorf("patternLabel(%v) = %q, want %q", tt.patterns, got, tt.want)
		}
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

// --- Functional Tests: getMatchSizes / getDirSize ---

func TestGetMatchSizesDirs(t *testing.T) {
	root := t.TempDir()

	dir1 := filepath.Join(root, "a")
	dir2 := filepath.Join(root, "b")
	os.MkdirAll(dir1, 0o755)
	os.MkdirAll(dir2, 0o755)

	os.WriteFile(filepath.Join(dir1, "f1.txt"), make([]byte, 1000), 0o644)
	os.WriteFile(filepath.Join(dir1, "f2.txt"), make([]byte, 2000), 0o644)
	os.WriteFile(filepath.Join(dir2, "f1.txt"), make([]byte, 500), 0o644)

	matches := []match{
		{path: dir1, isDir: true},
		{path: dir2, isDir: true},
	}

	sizes := getMatchSizes(matches, 4, nil)

	if sizes[0] != 3000 {
		t.Errorf("dir1 size = %d, want 3000", sizes[0])
	}

	if sizes[1] != 500 {
		t.Errorf("dir2 size = %d, want 500", sizes[1])
	}
}

func TestGetMatchSizesFiles(t *testing.T) {
	root := t.TempDir()

	file1 := filepath.Join(root, "a.log")
	file2 := filepath.Join(root, "b.log")
	os.WriteFile(file1, make([]byte, 1234), 0o644)
	os.WriteFile(file2, make([]byte, 5678), 0o644)

	matches := []match{
		{path: file1, isDir: false},
		{path: file2, isDir: false},
	}

	sizes := getMatchSizes(matches, 4, nil)

	if sizes[0] != 1234 {
		t.Errorf("file1 size = %d, want 1234", sizes[0])
	}

	if sizes[1] != 5678 {
		t.Errorf("file2 size = %d, want 5678", sizes[1])
	}
}

func TestGetMatchSizesMixed(t *testing.T) {
	root := t.TempDir()

	dir1 := filepath.Join(root, "nm")
	os.MkdirAll(dir1, 0o755)
	os.WriteFile(filepath.Join(dir1, "f.txt"), make([]byte, 100), 0o644)

	file1 := filepath.Join(root, "a.log")
	os.WriteFile(file1, make([]byte, 200), 0o644)

	matches := []match{
		{path: dir1, isDir: true},
		{path: file1, isDir: false},
	}

	sizes := getMatchSizes(matches, 4, nil)

	if sizes[0] != 100 {
		t.Errorf("dir size = %d, want 100", sizes[0])
	}

	if sizes[1] != 200 {
		t.Errorf("file size = %d, want 200", sizes[1])
	}
}

func TestGetMatchSizesNested(t *testing.T) {
	root := t.TempDir()

	sub := filepath.Join(root, "sub")
	os.MkdirAll(sub, 0o755)

	os.WriteFile(filepath.Join(root, "f1.txt"), make([]byte, 100), 0o644)
	os.WriteFile(filepath.Join(sub, "f2.txt"), make([]byte, 200), 0o644)

	matches := []match{{path: root, isDir: true}}
	sizes := getMatchSizes(matches, 4, nil)

	if sizes[0] != 300 {
		t.Errorf("total size = %d, want 300", sizes[0])
	}
}

func TestGetMatchSizesEmpty(t *testing.T) {
	root := t.TempDir()

	matches := []match{{path: root, isDir: true}}
	sizes := getMatchSizes(matches, 4, nil)

	if sizes[0] != 0 {
		t.Errorf("empty dir size = %d, want 0", sizes[0])
	}
}

func TestGetMatchSizesDirErrorLogging(t *testing.T) {
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
	matches := []match{{path: root, isDir: true}}
	sizes := getMatchSizes(matches, 4, &buf)

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

// --- Functional Tests: removeMatches ---

func TestRemoveMatchesDirs(t *testing.T) {
	root := t.TempDir()
	matches := make([]match, 3)

	for i := range matches {
		d := filepath.Join(root, "nm_"+itoa(i))
		os.MkdirAll(d, 0o755)
		os.WriteFile(filepath.Join(d, "f.txt"), []byte("x"), 0o644)
		matches[i] = match{path: d, isDir: true}
	}

	removed, failed := removeMatches(matches, 4)

	if removed != 3 {
		t.Errorf("removed = %d, want 3", removed)
	}

	if failed != 0 {
		t.Errorf("failed = %d, want 0", failed)
	}

	for _, m := range matches {
		if _, err := os.Stat(m.path); !os.IsNotExist(err) {
			t.Errorf("directory %q should have been removed", m.path)
		}
	}
}

func TestRemoveMatchesFiles(t *testing.T) {
	root := t.TempDir()

	file1 := filepath.Join(root, "a.log")
	file2 := filepath.Join(root, "b.log")
	os.WriteFile(file1, []byte("log1"), 0o644)
	os.WriteFile(file2, []byte("log2"), 0o644)

	matches := []match{
		{path: file1, isDir: false},
		{path: file2, isDir: false},
	}

	removed, failed := removeMatches(matches, 4)

	if removed != 2 {
		t.Errorf("removed = %d, want 2", removed)
	}

	if failed != 0 {
		t.Errorf("failed = %d, want 0", failed)
	}

	for _, m := range matches {
		if _, err := os.Stat(m.path); !os.IsNotExist(err) {
			t.Errorf("file %q should have been removed", m.path)
		}
	}
}

func TestRemoveMatchesMixed(t *testing.T) {
	root := t.TempDir()

	dir1 := filepath.Join(root, "nm")
	os.MkdirAll(dir1, 0o755)
	os.WriteFile(filepath.Join(dir1, "f.txt"), []byte("x"), 0o644)

	file1 := filepath.Join(root, "a.log")
	os.WriteFile(file1, []byte("log"), 0o644)

	matches := []match{
		{path: dir1, isDir: true},
		{path: file1, isDir: false},
	}

	removed, failed := removeMatches(matches, 4)

	if removed != 2 {
		t.Errorf("removed = %d, want 2", removed)
	}

	if failed != 0 {
		t.Errorf("failed = %d, want 0", failed)
	}
}

func TestRemoveMatchesNonExistent(t *testing.T) {
	root := t.TempDir()
	matches := []match{{path: filepath.Join(root, "nonexistent"), isDir: true}}

	removed, failed := removeMatches(matches, 4)

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
		patterns:  defaultPatterns,
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
		patterns:  defaultPatterns,
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
		patterns:  defaultPatterns,
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
		patterns:  defaultPatterns,
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
		patterns:  defaultPatterns,
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
		patterns:  defaultPatterns,
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
		patterns:  defaultPatterns,
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

func BenchmarkFindMatches(b *testing.B) {
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
		matches := findMatches(root, defaultPatterns, exclude, 4, nil)
		if len(matches) != len(projects) {
			b.Fatalf("expected %d matches, got %d", len(projects), len(matches))
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

func BenchmarkGetMatchSizes(b *testing.B) {
	root := b.TempDir()

	// Create 3 independent trees to measure cross-tree parallelism.
	matches := make([]match, 3)
	for i := range matches {
		d := filepath.Join(root, "tree_"+itoa(i))
		os.MkdirAll(d, 0o755)
		createTestTree(b, d, 4, 3, 10)
		matches[i] = match{path: d, isDir: true}
	}

	b.ResetTimer()

	for range b.N {
		sizes := getMatchSizes(matches, 4, nil)
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
