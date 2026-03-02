package update

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

type Manifest struct {
	Version string           `json:"version"`
	Notes   string           `json:"notes,omitempty"`
	URL     string           `json:"url,omitempty"`
	SHA256  string           `json:"sha256,omitempty"`
	Assets  map[string]Asset `json:"assets,omitempty"`
}

type Asset struct {
	URL    string `json:"url"`
	SHA256 string `json:"sha256,omitempty"`
}

type Status struct {
	Enabled        bool   `json:"enabled"`
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion,omitempty"`
	Available      bool   `json:"available"`
	CanApply       bool   `json:"canApply"`
	Notes          string `json:"notes,omitempty"`
	Message        string `json:"message,omitempty"`
}

type Service struct {
	manifestURL    string
	currentVersion string
	httpClient     *http.Client

	mu    sync.Mutex
	cache cachedArtifact
}

type cachedArtifact struct {
	updateKey   string
	path        string
	prefetching bool
	lastError   string
	lastErrorAt time.Time
	lastReadyAt time.Time
	lastChecked time.Time
	lastVersion string
	lastURL     string
	lastSHA256  string
}

type resolvedUpdate struct {
	version string
	notes   string
	url     string
	sha256  string
}

func NewService(manifestURL string, currentVersion string) *Service {
	return &Service{
		manifestURL:    strings.TrimSpace(manifestURL),
		currentVersion: strings.TrimSpace(currentVersion),
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (service *Service) Check(ctx context.Context) (Status, error) {
	status := Status{
		Enabled:        service.manifestURL != "",
		CurrentVersion: service.currentVersion,
		Available:      false,
		CanApply:       false,
	}

	if service.manifestURL == "" {
		status.Message = "updates are not configured"
		return status, nil
	}

	resolved, err := service.resolveUpdate(ctx)
	if err != nil {
		status.Message = err.Error()
		return status, err
	}

	status.LatestVersion = resolved.version
	status.Notes = resolved.notes
	status.Available = compareVersions(resolved.version, service.currentVersion) > 0

	if !status.Available {
		status.Message = "already on latest version"
		return status, nil
	}

	executablePath, err := os.Executable()
	if err != nil {
		status.Message = "unable to resolve current executable"
		return status, nil
	}

	if strings.TrimSpace(executablePath) == "" {
		status.Message = "unable to resolve current executable"
		return status, nil
	}

	status.CanApply = true

	service.maybeStartPrefetch(resolved)
	status.Message = "update available"

	return status, nil
}

func (service *Service) Apply(ctx context.Context) (Status, error) {
	status, err := service.Check(ctx)
	if err != nil {
		return status, err
	}

	if !status.Available {
		return status, fmt.Errorf("no update available")
	}

	if !status.CanApply {
		return status, fmt.Errorf("update cannot be applied in this runtime")
	}

	resolved, err := service.resolveUpdate(ctx)
	if err != nil {
		return status, err
	}

	executablePath, err := os.Executable()
	if err != nil {
		return status, err
	}

	stagedPath, hasCached := service.getCachedArtifact(resolved)
	if !hasCached {
		stagedPath, err = service.downloadAndVerify(ctx, resolved)
		if err != nil {
			return status, err
		}
	}

	if err := spawnApplyHelper(executablePath, stagedPath, os.Args[1:]); err != nil {
		return status, err
	}

	status.Message = "restarting to apply update"

	return status, nil
}

func (service *Service) maybeStartPrefetch(update resolvedUpdate) {
	key := cacheKey(update)

	service.mu.Lock()
	if service.cache.updateKey == key {
		if service.cache.prefetching {
			service.mu.Unlock()
			return
		}

		if service.cache.path != "" {
			path := service.cache.path
			service.mu.Unlock()
			if service.validateDownloadedFile(path, update.sha256) == nil {
				return
			}
			service.invalidateCache(key)
			service.mu.Lock()
		}
	}

	previousPath := service.cache.path
	service.cache = cachedArtifact{
		updateKey:   key,
		prefetching: true,
		lastChecked: time.Now(),
		lastVersion: update.version,
		lastURL:     update.url,
		lastSHA256:  update.sha256,
	}
	service.mu.Unlock()

	if previousPath != "" {
		_ = os.Remove(previousPath)
	}

	go func() {
		contextWithTimeout, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()

		path, err := service.downloadAndVerify(contextWithTimeout, update)

		service.mu.Lock()
		defer service.mu.Unlock()

		if service.cache.updateKey != key {
			if path != "" {
				_ = os.Remove(path)
			}
			return
		}

		service.cache.prefetching = false
		service.cache.lastChecked = time.Now()
		if err != nil {
			service.cache.lastError = err.Error()
			service.cache.lastErrorAt = time.Now()
			service.cache.path = ""
			return
		}

		service.cache.path = path
		service.cache.lastError = ""
		service.cache.lastReadyAt = time.Now()
	}()
}

func (service *Service) invalidateCache(key string) {
	service.mu.Lock()
	defer service.mu.Unlock()

	if service.cache.updateKey != key {
		return
	}

	service.cache.path = ""
	service.cache.prefetching = false
}

func (service *Service) hasCachedArtifact(update resolvedUpdate) bool {
	path, hasCached := service.getCachedArtifact(update)
	if !hasCached {
		return false
	}

	if strings.TrimSpace(path) == "" {
		return false
	}

	return true
}

func (service *Service) isPrefetching(update resolvedUpdate) bool {
	service.mu.Lock()
	defer service.mu.Unlock()

	if service.cache.updateKey != cacheKey(update) {
		return false
	}

	return service.cache.prefetching
}

func (service *Service) getCachedArtifact(update resolvedUpdate) (string, bool) {
	key := cacheKey(update)

	service.mu.Lock()
	if service.cache.updateKey != key {
		service.mu.Unlock()
		return "", false
	}

	if service.cache.prefetching {
		service.mu.Unlock()
		return "", false
	}

	cachedPath := service.cache.path
	service.mu.Unlock()

	if cachedPath == "" {
		return "", false
	}

	if err := service.validateDownloadedFile(cachedPath, update.sha256); err != nil {
		service.invalidateCache(key)
		_ = os.Remove(cachedPath)
		return "", false
	}

	return cachedPath, true
}

func (service *Service) validateDownloadedFile(path string, expectedSHA string) error {
	fileInfo, err := os.Stat(path)
	if err != nil {
		return err
	}
	if fileInfo.IsDir() {
		return fmt.Errorf("cached update path is a directory")
	}

	expectedSHA = strings.TrimSpace(strings.ToLower(expectedSHA))
	if expectedSHA == "" {
		return nil
	}

	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	hasher := sha256.New()
	if _, err := io.Copy(hasher, file); err != nil {
		return err
	}

	actualSHA := hex.EncodeToString(hasher.Sum(nil))
	if actualSHA != expectedSHA {
		return fmt.Errorf("cached update hash mismatch")
	}

	return nil
}

func (service *Service) resolveUpdate(ctx context.Context) (resolvedUpdate, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, service.manifestURL, nil)
	if err != nil {
		return resolvedUpdate{}, err
	}

	response, err := service.httpClient.Do(request)
	if err != nil {
		return resolvedUpdate{}, err
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode > 299 {
		return resolvedUpdate{}, fmt.Errorf("manifest request failed: %s", response.Status)
	}

	var manifest Manifest
	if err := json.NewDecoder(response.Body).Decode(&manifest); err != nil {
		return resolvedUpdate{}, err
	}

	version := strings.TrimSpace(manifest.Version)
	if version == "" {
		return resolvedUpdate{}, fmt.Errorf("manifest missing version")
	}

	selectedURL := strings.TrimSpace(manifest.URL)
	selectedSHA := strings.TrimSpace(manifest.SHA256)

	if len(manifest.Assets) > 0 {
		asset, hasAsset := manifest.Assets[runtimeKey()]
		if !hasAsset {
			return resolvedUpdate{}, fmt.Errorf("manifest missing asset for %s", runtimeKey())
		}

		selectedURL = strings.TrimSpace(asset.URL)
		selectedSHA = strings.TrimSpace(asset.SHA256)
	}

	if selectedURL == "" {
		return resolvedUpdate{}, fmt.Errorf("manifest missing update url")
	}

	return resolvedUpdate{
		version: version,
		notes:   strings.TrimSpace(manifest.Notes),
		url:     selectedURL,
		sha256:  strings.ToLower(selectedSHA),
	}, nil
}

func (service *Service) downloadAndVerify(ctx context.Context, update resolvedUpdate) (string, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, update.url, nil)
	if err != nil {
		return "", err
	}

	response, err := service.httpClient.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode > 299 {
		return "", fmt.Errorf("update download failed: %s", response.Status)
	}

	updatesDir := filepath.Join(os.TempDir(), "food-guru-updates")
	if err := os.MkdirAll(updatesDir, 0o755); err != nil {
		return "", err
	}

	suffix := ""
	if runtime.GOOS == "windows" {
		suffix = ".exe"
	}

	stagedPath := filepath.Join(updatesDir, "food-guru-update-"+strconv.FormatInt(time.Now().UnixNano(), 10)+suffix)
	file, err := os.Create(stagedPath)
	if err != nil {
		return "", err
	}

	hasher := sha256.New()
	_, copyErr := io.Copy(io.MultiWriter(file, hasher), response.Body)
	closeErr := file.Close()
	if copyErr != nil {
		_ = os.Remove(stagedPath)
		return "", copyErr
	}
	if closeErr != nil {
		_ = os.Remove(stagedPath)
		return "", closeErr
	}

	if update.sha256 != "" {
		actual := hex.EncodeToString(hasher.Sum(nil))
		if actual != update.sha256 {
			_ = os.Remove(stagedPath)
			return "", fmt.Errorf("downloaded update hash mismatch")
		}
	}

	if runtime.GOOS != "windows" {
		if err := os.Chmod(stagedPath, 0o755); err != nil {
			_ = os.Remove(stagedPath)
			return "", err
		}
	}

	return stagedPath, nil
}

func spawnApplyHelper(targetPath string, stagedPath string, restartArgs []string) error {
	if runtime.GOOS == "windows" {
		return spawnWindowsApplyHelper(targetPath, stagedPath, restartArgs)
	}

	return spawnPosixApplyHelper(targetPath, stagedPath, restartArgs)
}

func spawnWindowsApplyHelper(targetPath string, stagedPath string, restartArgs []string) error {
	updatesDir := filepath.Join(os.TempDir(), "food-guru-updates")
	if err := os.MkdirAll(updatesDir, 0o755); err != nil {
		return err
	}

	scriptPath := filepath.Join(updatesDir, "apply-update-"+strconv.FormatInt(time.Now().UnixNano(), 10)+".cmd")

	restartCommand := quoteCmdArg(targetPath)
	if len(restartArgs) > 0 {
		restartCommand += " " + joinCmdArgs(restartArgs)
	}

	script := strings.Join([]string{
		"@echo off",
		"timeout /t 2 /nobreak >nul",
		"copy /Y " + quoteCmdArg(stagedPath) + " " + quoteCmdArg(targetPath) + " >nul",
		"start \"\" " + restartCommand,
		"del /F /Q " + quoteCmdArg(stagedPath) + " >nul 2>nul",
		"del /F /Q \"%~f0\" >nul 2>nul",
	}, "\r\n")

	if err := os.WriteFile(scriptPath, []byte(script), 0o700); err != nil {
		return err
	}

	command := exec.Command("cmd", "/C", scriptPath)
	command.Stdout = nil
	command.Stderr = nil

	return command.Start()
}

func spawnPosixApplyHelper(targetPath string, stagedPath string, restartArgs []string) error {
	updatesDir := filepath.Join(os.TempDir(), "food-guru-updates")
	if err := os.MkdirAll(updatesDir, 0o755); err != nil {
		return err
	}

	scriptPath := filepath.Join(updatesDir, "apply-update-"+strconv.FormatInt(time.Now().UnixNano(), 10)+".sh")

	restartCommand := quoteShArg(targetPath)
	if len(restartArgs) > 0 {
		restartCommand += " " + joinShArgs(restartArgs)
	}

	script := strings.Join([]string{
		"#!/bin/sh",
		"sleep 1",
		"mv -f " + quoteShArg(stagedPath) + " " + quoteShArg(targetPath),
		"chmod +x " + quoteShArg(targetPath),
		restartCommand + " >/dev/null 2>&1 &",
		"rm -f " + quoteShArg(scriptPath),
	}, "\n")

	if err := os.WriteFile(scriptPath, []byte(script), 0o700); err != nil {
		return err
	}

	command := exec.Command("/bin/sh", scriptPath)
	command.Stdout = nil
	command.Stderr = nil

	return command.Start()
}

func runtimeKey() string {
	return runtime.GOOS + "-" + runtime.GOARCH
}

func cacheKey(update resolvedUpdate) string {
	return update.version + "|" + update.url + "|" + update.sha256
}

func compareVersions(left string, right string) int {
	leftParts := parseVersionParts(left)
	rightParts := parseVersionParts(right)
	maxLength := len(leftParts)
	if len(rightParts) > maxLength {
		maxLength = len(rightParts)
	}

	for index := 0; index < maxLength; index++ {
		leftPart := 0
		rightPart := 0
		if index < len(leftParts) {
			leftPart = leftParts[index]
		}
		if index < len(rightParts) {
			rightPart = rightParts[index]
		}

		if leftPart > rightPart {
			return 1
		}
		if leftPart < rightPart {
			return -1
		}
	}

	return 0
}

func parseVersionParts(version string) []int {
	normalized := strings.TrimSpace(strings.TrimPrefix(strings.ToLower(version), "v"))
	if normalized == "" {
		return []int{0}
	}

	segments := strings.Split(normalized, ".")
	parts := make([]int, 0, len(segments))
	for _, segment := range segments {
		numberPart := segment
		for index, char := range segment {
			if char < '0' || char > '9' {
				numberPart = segment[:index]
				break
			}
		}

		if numberPart == "" {
			parts = append(parts, 0)
			continue
		}

		value, err := strconv.Atoi(numberPart)
		if err != nil {
			parts = append(parts, 0)
			continue
		}

		parts = append(parts, value)
	}

	if len(parts) == 0 {
		return []int{0}
	}

	return parts
}

func quoteShArg(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "'\\''") + "'"
}

func joinShArgs(args []string) string {
	quoted := make([]string, 0, len(args))
	for _, arg := range args {
		quoted = append(quoted, quoteShArg(arg))
	}

	return strings.Join(quoted, " ")
}

func quoteCmdArg(value string) string {
	return "\"" + strings.ReplaceAll(value, "\"", "\"\"") + "\""
}

func joinCmdArgs(args []string) string {
	quoted := make([]string, 0, len(args))
	for _, arg := range args {
		quoted = append(quoted, quoteCmdArg(arg))
	}

	return strings.Join(quoted, " ")
}
