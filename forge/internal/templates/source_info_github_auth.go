package templates

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

type githubUserConfig struct {
	GitHub struct {
		Token string `yaml:"token"`
	} `yaml:"github"`
}

func resolveGitHubToken() (string, error) {
	if token := strings.TrimSpace(os.Getenv("GITHUB_TOKEN")); token != "" {
		return token, nil
	}

	if token, err := readGitHubTokenFromConfig(); err == nil && token != "" {
		return token, nil
	}

	token, err := PromptAndSaveGitHubToken()
	if err != nil {
		return "", err
	}

	return token, nil
}

func ResolveGitHubToken() (string, error) {
	return resolveGitHubToken()
}

func GitHubTokenStatus() (envConfigured bool, configConfigured bool, configPath string, err error) {
	path, err := githubTokenConfigPath()
	if err != nil {
		return false, false, "", err
	}

	envConfigured = strings.TrimSpace(os.Getenv("GITHUB_TOKEN")) != ""

	token, readErr := readGitHubTokenFromConfig()
	if readErr != nil {
		if !os.IsNotExist(readErr) {
			return envConfigured, false, path, readErr
		}
		return envConfigured, false, path, nil
	}

	configConfigured = strings.TrimSpace(token) != ""
	return envConfigured, configConfigured, path, nil
}

func PromptAndSaveGitHubToken() (string, error) {
	if !canPromptForSecret() {
		return "", fmt.Errorf("GITHUB_TOKEN not set and interactive prompt unavailable")
	}

	path, err := githubTokenConfigPath()
	if err != nil {
		return "", err
	}

	fmt.Fprintf(os.Stderr, "forge: GitHub token required for GraphQL metadata fetch.\n")
	fmt.Fprintf(os.Stderr, "forge: Enter GitHub token (saved to %s): ", path)

	reader := bufio.NewReader(os.Stdin)
	line, err := reader.ReadString('\n')
	if err != nil {
		return "", fmt.Errorf("reading github token input: %w", err)
	}

	token := strings.TrimSpace(line)
	if token == "" {
		return "", fmt.Errorf("empty token provided")
	}

	if err := SaveGitHubToken(token); err != nil {
		return "", err
	}
	fmt.Fprintln(os.Stderr, "forge: GitHub token saved.")

	return token, nil
}

func SaveGitHubToken(token string) error {
	trimmed := strings.TrimSpace(token)
	if trimmed == "" {
		return fmt.Errorf("empty token provided")
	}

	if err := writeGitHubTokenToConfig(trimmed); err != nil {
		return err
	}

	_ = os.Setenv("GITHUB_TOKEN", trimmed)
	return nil
}

func ClearGitHubToken() error {
	path, err := githubTokenConfigPath()
	if err != nil {
		return err
	}

	if existing, readErr := os.ReadFile(path); readErr == nil {
		var cfg githubUserConfig
		if err := yaml.Unmarshal(existing, &cfg); err != nil {
			return fmt.Errorf("parsing github token config %s: %w", path, err)
		}

		cfg.GitHub.Token = ""
		encoded, err := yaml.Marshal(&cfg)
		if err != nil {
			return fmt.Errorf("encoding github token config: %w", err)
		}

		if err := os.WriteFile(path, encoded, 0o600); err != nil {
			return fmt.Errorf("writing github token config %s: %w", path, err)
		}
	} else if !os.IsNotExist(readErr) {
		return fmt.Errorf("reading github token config %s: %w", path, readErr)
	}

	_ = os.Unsetenv("GITHUB_TOKEN")
	return nil
}

func canPromptForSecret() bool {
	stdinInfo, err := os.Stdin.Stat()
	if err != nil {
		return false
	}
	stdoutInfo, err := os.Stdout.Stat()
	if err != nil {
		return false
	}

	return (stdinInfo.Mode()&os.ModeCharDevice) != 0 && (stdoutInfo.Mode()&os.ModeCharDevice) != 0
}

func githubTokenConfigPath() (string, error) {
	cfgDir, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("resolving user config directory: %w", err)
	}

	return filepath.Join(cfgDir, "forge", "config.yaml"), nil
}

func readGitHubTokenFromConfig() (string, error) {
	path, err := githubTokenConfigPath()
	if err != nil {
		return "", err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}

	var cfg githubUserConfig
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return "", fmt.Errorf("parsing github token config %s: %w", path, err)
	}

	return strings.TrimSpace(cfg.GitHub.Token), nil
}

func writeGitHubTokenToConfig(token string) error {
	path, err := githubTokenConfigPath()
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return fmt.Errorf("creating config directory for github token: %w", err)
	}

	var cfg githubUserConfig
	if existing, err := os.ReadFile(path); err == nil {
		_ = yaml.Unmarshal(existing, &cfg)
	}
	cfg.GitHub.Token = strings.TrimSpace(token)

	encoded, err := yaml.Marshal(&cfg)
	if err != nil {
		return fmt.Errorf("encoding github token config: %w", err)
	}

	if err := os.WriteFile(path, encoded, 0o600); err != nil {
		return fmt.Errorf("writing github token config %s: %w", path, err)
	}

	return nil
}
