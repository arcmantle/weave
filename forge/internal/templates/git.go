package templates

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// LoadFromGit clones a git repository to a temporary directory and loads
// a template from it. The URL format supports a fragment to specify a
// subdirectory within the repo:
//
//	https://github.com/user/repo             → root of repo
//	https://github.com/user/repo#path/to/tpl → subdirectory
func LoadFromGit(url string) (*Template, error) {
	repoURL, subdir := parseGitURL(url)

	// Create a temp directory for the clone.
	tmpDir, err := os.MkdirTemp("", "forge-template-*")
	if err != nil {
		return nil, fmt.Errorf("creating temp directory: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	// Clone with depth 1 for speed.
	cmd := exec.Command("git", "clone", "--depth", "1", repoURL, tmpDir)
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("cloning %s: %w", repoURL, err)
	}

	templateDir := tmpDir
	if subdir != "" {
		templateDir = filepath.Join(tmpDir, filepath.FromSlash(subdir))
	}

	// Check that a template.yaml exists in the target directory.
	metaPath := filepath.Join(templateDir, "template.yaml")
	if _, err := os.Stat(metaPath); os.IsNotExist(err) {
		// Try to find template directories within the target.
		entries, dirErr := os.ReadDir(templateDir)
		if dirErr != nil {
			return nil, fmt.Errorf("no template.yaml found at %s", url)
		}

		// If there's exactly one subdirectory with a template.yaml, use it.
		for _, entry := range entries {
			if entry.IsDir() {
				candidate := filepath.Join(templateDir, entry.Name(), "template.yaml")
				if _, err := os.Stat(candidate); err == nil {
					templateDir = filepath.Join(templateDir, entry.Name())
					break
				}
			}
		}

		// Recheck.
		metaPath = filepath.Join(templateDir, "template.yaml")
		if _, err := os.Stat(metaPath); os.IsNotExist(err) {
			return nil, fmt.Errorf("no template.yaml found in %s (or its subdirectories)", url)
		}
	}

	return LoadFromDir(templateDir)
}

// parseGitURL splits a URL into the repository URL and an optional
// subdirectory path specified after a # fragment.
func parseGitURL(url string) (string, string) {
	if idx := strings.Index(url, "#"); idx != -1 {
		return url[:idx], url[idx+1:]
	}

	return url, ""
}
