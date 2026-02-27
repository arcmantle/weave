package manifest

import (
	"os"
	"path/filepath"
)

const ManifestFile = "forge.yaml"

// scriptExtensions lists the file extensions that are recognized as forge scripts.
var scriptExtensions = []string{".go", ".ts", ".cs"}

// skipDirs are directory names to ignore during downward traversal.
var skipDirs = map[string]bool{
	"node_modules": true,
	".git":         true,
	".forge":       true,
	"bin":          true,
	"obj":          true,
	"dist":         true,
	"out":          true,
	"vendor":       true,
}

// Discover walks up from startDir to the filesystem root, collecting all
// forge.yaml files found along the way. Returns them ordered from root
// (furthest ancestor) to startDir (closest), so that merging gives
// priority to the closest manifest.
func Discover(startDir string) ([]*Manifest, error) {
	var paths []string
	dir := startDir

	for {
		candidate := filepath.Join(dir, ManifestFile)
		if _, err := os.Stat(candidate); err == nil {
			paths = append(paths, candidate)
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			break // reached filesystem root
		}
		dir = parent
	}

	if len(paths) == 0 {
		return nil, nil
	}

	// Reverse so root-level manifest is first, closest is last.
	for i, j := 0, len(paths)-1; i < j; i, j = i+1, j-1 {
		paths[i], paths[j] = paths[j], paths[i]
	}

	var manifests []*Manifest
	for _, p := range paths {
		m, err := Load(p)
		if err != nil {
			return nil, err
		}
		manifests = append(manifests, m)
	}

	return manifests, nil
}

// DiscoverScripts walks up from startDir to the filesystem root, collecting
// auto-discovered scripts from .forge/scripts/ directories. Each subdirectory
// in .forge/scripts/ that contains a script file matching <name>.{go,ts,cs}
// becomes a command.
//
// Returns manifests ordered from root (furthest ancestor) to startDir
// (closest), matching the same convention as Discover.
func DiscoverScripts(startDir string) ([]*Manifest, error) {
	var manifests []*Manifest
	dir := startDir

	for {
		scriptsDir := filepath.Join(dir, ".forge", "scripts")
		if info, err := os.Stat(scriptsDir); err == nil && info.IsDir() {
			m, err := discoverScriptsInDir(scriptsDir, dir)
			if err != nil {
				return nil, err
			}
			if m != nil && len(m.Commands) > 0 {
				manifests = append(manifests, m)
			}
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			break // reached filesystem root
		}
		dir = parent
	}

	if len(manifests) == 0 {
		return nil, nil
	}

	// Reverse so root-level is first, closest is last.
	for i, j := 0, len(manifests)-1; i < j; i, j = i+1, j-1 {
		manifests[i], manifests[j] = manifests[j], manifests[i]
	}

	return manifests, nil
}

// discoverScriptsInDir scans a .forge/scripts/ directory and creates
// auto-discovered commands from script subdirectories.
//
// Convention: .forge/scripts/<name>/<name>.{go,ts,cs}
// The first matching extension wins (checked in order: .go, .ts, .cs).
func discoverScriptsInDir(scriptsDir string, manifestDir string) (*Manifest, error) {
	entries, err := os.ReadDir(scriptsDir)
	if err != nil {
		return nil, nil // skip unreadable directories
	}

	m := &Manifest{Commands: make(map[string]Command)}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		name := entry.Name()
		scriptSubDir := filepath.Join(scriptsDir, name)

		for _, ext := range scriptExtensions {
			scriptFile := filepath.Join(scriptSubDir, name+ext)
			if _, err := os.Stat(scriptFile); err == nil {
				relPath := filepath.Join(".forge", "scripts", name, name+ext)
				m.Commands[name] = Command{
					Script:      relPath,
					ManifestDir: manifestDir,
				}
				break // use first matching extension
			}
		}
	}

	return m, nil
}

// DiscoverDown walks into subdirectories of startDir, collecting all
// forge.yaml files found below (excluding startDir itself to avoid
// double-counting with upward discovery). Returns manifests ordered
// by path depth so shallower directories appear first.
func DiscoverDown(startDir string) ([]*Manifest, error) {
	var manifests []*Manifest

	err := filepath.WalkDir(startDir, func(p string, d os.DirEntry, err error) error {
		if err != nil {
			return nil // skip unreadable entries
		}

		if d.IsDir() {
			if skipDirs[d.Name()] {
				return filepath.SkipDir
			}

			return nil
		}

		if d.Name() != ManifestFile {
			return nil
		}

		// Skip the startDir's own manifest — upward discovery already covers it.
		if filepath.Dir(p) == startDir {
			return nil
		}

		m, loadErr := Load(p)
		if loadErr != nil {
			return nil // skip unparseable manifests
		}

		manifests = append(manifests, m)

		return nil
	})

	if err != nil {
		return nil, err
	}

	return manifests, nil
}

// DiscoverScriptsDown walks into subdirectories of startDir, collecting
// auto-discovered scripts from .forge/scripts/ directories below
// (excluding startDir itself). Returns manifests ordered by path depth.
func DiscoverScriptsDown(startDir string) ([]*Manifest, error) {
	var manifests []*Manifest

	err := filepath.WalkDir(startDir, func(p string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}

		if !d.IsDir() {
			return nil
		}

		if skipDirs[d.Name()] {
			return filepath.SkipDir
		}

		// Skip startDir itself — upward discovery handles it.
		if p == startDir {
			return nil
		}

		scriptsDir := filepath.Join(p, ".forge", "scripts")
		info, statErr := os.Stat(scriptsDir)
		if statErr != nil || !info.IsDir() {
			return nil
		}

		m, discoverErr := discoverScriptsInDir(scriptsDir, p)
		if discoverErr != nil {
			return nil
		}

		if m != nil && len(m.Commands) > 0 {
			manifests = append(manifests, m)
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return manifests, nil
}
