package helpers

import (
	"os"
	"path/filepath"
)

// FindDirs returns directories matching a glob pattern, relative to root.
func FindDirs(root string, pattern string) ([]string, error) {
	matches, err := filepath.Glob(filepath.Join(root, pattern))
	if err != nil {
		return nil, err
	}

	var dirs []string
	for _, m := range matches {
		info, err := os.Stat(m)
		if err != nil {
			continue
		}
		if info.IsDir() {
			dirs = append(dirs, m)
		}
	}

	return dirs, nil
}

// FindFiles returns files matching a glob pattern, relative to root.
func FindFiles(root string, pattern string) ([]string, error) {
	matches, err := filepath.Glob(filepath.Join(root, pattern))
	if err != nil {
		return nil, err
	}

	var files []string
	for _, m := range matches {
		info, err := os.Stat(m)
		if err != nil {
			continue
		}
		if !info.IsDir() {
			files = append(files, m)
		}
	}

	return files, nil
}

// FileExists checks if a file exists at the given path.
func FileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// FindDirsContaining finds all child directories of root that contain a specific file.
func FindDirsContaining(root string, filename string) ([]string, error) {
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil, err
	}

	var dirs []string
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		candidate := filepath.Join(root, entry.Name(), filename)
		if FileExists(candidate) {
			dirs = append(dirs, filepath.Join(root, entry.Name()))
		}
	}

	return dirs, nil
}
