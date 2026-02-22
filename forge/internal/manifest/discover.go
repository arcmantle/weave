package manifest

import (
	"os"
	"path/filepath"
)

const ManifestFile = "forge.yaml"

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
