package main

import (
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
)

// createTestTree builds a synthetic node_modules-like tree for benchmarking.
// Structure: depth levels of directories, each with the given number of
// subdirectories and files per directory.
func createTestTree(b *testing.B, root string, depth, dirsPerLevel, filesPerDir int) {
	b.Helper()

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
		createTestTree(b, sub, depth-1, dirsPerLevel, filesPerDir)
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
		dirs := findNodeModules(root, exclude, 4)
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
		getDirSize(root, sem, &total)

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
		sizes := getDirSizes(dirs, 4)
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
