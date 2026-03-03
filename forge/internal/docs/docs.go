// Package docs implements a self-hosted documentation server for forge.
// It collects metadata from all commands in the manifest and serves
// an interactive single-page documentation site.
package docs

import (
	"bufio"
	"context"
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/arcmantle/forge/internal/manifest"
	"github.com/arcmantle/forge/internal/runner"
	"github.com/arcmantle/forge/internal/templates"
)

//go:embed dist/index.html dist/styles.css dist/app-shell.js
var staticFiles embed.FS

// DocData is the top-level JSON structure injected into the HTML template.
type DocData struct {
	ProjectName string        `json:"projectName"`
	Version     string        `json:"version"`
	RunCwd      string        `json:"runCwd,omitempty"`
	Commands    []DocCommand  `json:"commands"`
	TemplateCount int         `json:"templateCount,omitempty"`
	RegistrySources []DocRegistrySource `json:"registrySources,omitempty"`
	InstallTargets []DocInstallTarget `json:"installTargets,omitempty"`
}

// DocRegistrySource summarizes template counts per source for registry filtering.
type DocRegistrySource struct {
	Name       string `json:"name"`
	Count      int    `json:"count"`
	SourceType string `json:"sourceType,omitempty"`
}

// DocInstallTarget represents a directory where template installation can occur.
type DocInstallTarget struct {
	Path  string `json:"path"`
	Label string `json:"label"`
}

// DocTemplate represents a script template available from built-in or registry sources.
type DocTemplate struct {
	ID          string             `json:"id"`
	Name        string             `json:"name"`
	Description string             `json:"description"`
	Languages   []string           `json:"languages"`
	Variables   []DocTemplateVar   `json:"variables,omitempty"`
	Example     string             `json:"example,omitempty"`
	LatestTag   string             `json:"latestTag,omitempty"`
	Versions    []string           `json:"versions,omitempty"`
	Source      string             `json:"source"` // "built-in" or registry name
	SourceType  string             `json:"sourceType,omitempty"`
}

// DocTemplateSummary is a lightweight list item for registry search results.
type DocTemplateSummary struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Languages   []string `json:"languages"`
	LatestTag   string   `json:"latestTag,omitempty"`
	Source      string   `json:"source"`
	SourceType  string   `json:"sourceType,omitempty"`
}

type templateRegistry struct {
	all       []DocTemplateSummary
	fullByID  map[string]DocTemplate
	sources   map[string][]int
	searchIdx []string
}

func buildTemplateRegistry(allTemplates []templates.TemplateInfo) templateRegistry {
	registry := templateRegistry{
		fullByID: make(map[string]DocTemplate, len(allTemplates)),
		sources:  map[string][]int{},
	}

	for _, t := range allTemplates {
		id := templateID(t.Source, t.Name)
		summary := DocTemplateSummary{
			ID:          id,
			Name:        t.Name,
			Description: t.Description,
			Languages:   append([]string{}, t.Languages...),
			LatestTag:   t.LatestTag,
			Source:      t.Source,
			SourceType:  docSourceTypeLabel(t.SourceType),
		}
		full := DocTemplate{
			ID:          id,
			Name:        t.Name,
			Description: t.Description,
			Languages:   append([]string{}, t.Languages...),
			Example:     t.Example,
			LatestTag:   t.LatestTag,
			Versions:    append([]string{}, t.Versions...),
			Source:      t.Source,
			SourceType:  docSourceTypeLabel(t.SourceType),
		}
		for _, v := range t.Variables {
			full.Variables = append(full.Variables, DocTemplateVar{
				Name:        v.Name,
				Description: v.Description,
				Default:     v.Default,
			})
		}

		idx := len(registry.all)
		registry.all = append(registry.all, summary)
		registry.fullByID[id] = full
		registry.sources[summary.Source] = append(registry.sources[summary.Source], idx)

		searchBlob := strings.ToLower(summary.Name + "\n" + summary.Description + "\n" + strings.Join(summary.Languages, " "))
		registry.searchIdx = append(registry.searchIdx, searchBlob)
	}

	return registry
}

func (s templateRegistry) ByID(id string) (DocTemplate, bool) {
	tpl, ok := s.fullByID[id]

	return tpl, ok
}

func (s templateRegistry) Search(query, source string, offset, limit int) (int, []DocTemplateSummary) {
	q := strings.ToLower(strings.TrimSpace(query))
	src := strings.TrimSpace(source)

	baseIndexes := make([]int, 0)
	if src != "" {
		baseIndexes = append(baseIndexes, s.sources[src]...)
	} else {
		baseIndexes = make([]int, len(s.all))
		for i := range s.all {
			baseIndexes[i] = i
		}
	}

	if q != "" {
		filtered := make([]int, 0, len(baseIndexes))
		for _, idx := range baseIndexes {
			if strings.Contains(s.searchIdx[idx], q) {
				filtered = append(filtered, idx)
			}
		}
		baseIndexes = filtered
	}

	total := len(baseIndexes)
	if offset >= total {
		return total, []DocTemplateSummary{}
	}

	end := offset + limit
	if end > total {
		end = total
	}

	out := make([]DocTemplateSummary, 0, end-offset)
	for _, idx := range baseIndexes[offset:end] {
		out = append(out, s.all[idx])
	}

	return total, out
}

func templateID(source, name string) string {
	return source + "|" + name
}

func clampParseInt(value string, fallback, minVal, maxVal int) int {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	v, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil {
		return fallback
	}
	if v < minVal {
		v = minVal
	}
	if v > maxVal {
		v = maxVal
	}

	return v
}

// DocTemplateVar describes a variable placeholder in a template.
type DocTemplateVar struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Default     string `json:"default,omitempty"`
}

// DocCommand represents a single command's documentation.
type DocCommand struct {
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CommandType string    `json:"commandType"` // "script" or "composite"
	Source      string    `json:"source,omitempty"`
	RunPath     string    `json:"runPath,omitempty"`
	SourcePath  string    `json:"sourcePath,omitempty"`
	Script      string    `json:"script,omitempty"`
	ScriptPath  string    `json:"scriptPath,omitempty"`
	Language    string    `json:"language,omitempty"`
	Example     string    `json:"example,omitempty"`
	Positionals []DocArg  `json:"positionals,omitempty"`
	Flags       []DocArg  `json:"flags,omitempty"`
	Steps       []DocStep `json:"steps,omitempty"`
}

// DocArg represents a single argument, flag, or option.
type DocArg struct {
	Name         string `json:"name"`
	Type         string `json:"type"`
	Description  string `json:"description"`
	Required     bool   `json:"required,omitempty"`
	DefaultValue string `json:"defaultValue,omitempty"`
}

// DocStep represents a single step in a composite command.
type DocStep struct {
	Command  string   `json:"command,omitempty"`
	Args     []string `json:"args,omitempty"`
	Parallel []string `json:"parallel,omitempty"`
}

// Serve starts an HTTP server immediately, opens the browser, and
// streams command metadata as it's collected. The page loads instantly
// with basic manifest data, then receives progressive updates via SSE.
func Serve(m *manifest.Manifest, version string) error {
	allTemplates := templates.ListAllTemplates(m.Registries)
	registry := buildTemplateRegistry(allTemplates)

	// Build basic data from manifest (instant — no compilation).
	basicData := collectBasicData(m, version, allTemplates)
	basicJSON, err := json.Marshal(basicData)
	if err != nil {
		return fmt.Errorf("marshaling basic data: %w", err)
	}

	var stateMu sync.RWMutex
	currentManifest := m
	currentData := basicData
	currentJSON := basicJSON
	currentRegistry := registry

	allowedInstallTargets := map[string]bool{}
	for _, t := range currentData.InstallTargets {
		allowedInstallTargets[filepath.Clean(t.Path)] = true
	}

	// Use a stable fixed port; if an existing docs instance is running,
	// request it to shut down and then reclaim the port.
	const basePort = 4000
	listener, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", basePort))
	if err != nil {
		requestExistingDocsShutdown(basePort)
		listener, err = waitForDocsListener(basePort, 5*time.Second)
		if err != nil {
			return fmt.Errorf("could not start docs server on port %d: %w", basePort, err)
		}
	}

	port := basePort
	url := fmt.Sprintf("http://localhost:%d", port)

	// SSE event broadcasting — multiple browser tabs can connect.
	// Events are buffered so late-connecting clients get the full history.
	var (
		sseClientsMu sync.Mutex
		sseClients   = make(map[chan []byte]struct{})
		sseHistory   [][]byte
	)

	broadcast := func(event string, data []byte) {
		msg := []byte(fmt.Sprintf("event: %s\ndata: %s\n\n", event, data))
		sseClientsMu.Lock()
		sseHistory = append(sseHistory, msg)
		for ch := range sseClients {
			select {
			case ch <- msg:
			default:
				// Client too slow — skip this event.
			}
		}
		sseClientsMu.Unlock()
	}

	// Metadata collection is restartable (used by refresh).
	var metaMu sync.Mutex
	var metaCancel context.CancelFunc
	startMetaCollection := func(man *manifest.Manifest) {
		metaMu.Lock()
		if metaCancel != nil {
			metaCancel()
		}
		ctx, cancel := context.WithCancel(context.Background())
		metaCancel = cancel
		metaMu.Unlock()

		go collectAndStream(ctx, man, broadcast)
	}

	// Collect metadata in background, broadcasting each result via SSE.
	startMetaCollection(currentManifest)

	mux := http.NewServeMux()

	// Serve embedded static files with ETag caching.
	type staticAsset struct {
		data        []byte
		contentType string
	}

	assets := map[string]staticAsset{}
	for _, entry := range []struct {
		name        string
		path        string
		contentType string
	}{
		{"index.html", "dist/index.html", "text/html; charset=utf-8"},
		{"styles.css", "dist/styles.css", "text/css; charset=utf-8"},
		{"app-shell.js", "dist/app-shell.js", "application/javascript; charset=utf-8"},
	} {
		data, _ := staticFiles.ReadFile(entry.path)
		assets[entry.name] = staticAsset{data: data, contentType: entry.contentType}
	}

	// Compute a combined ETag from all static assets.
	h := sha256.New()
	for _, name := range []string{"index.html", "styles.css", "app-shell.js"} {
		h.Write(assets[name].data)
	}
	etag := `"` + hex.EncodeToString(h.Sum(nil)[:8]) + `"`

	serveAsset := func(name string) http.HandlerFunc {
		asset := assets[name]
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", asset.contentType)
			w.Header().Set("Cache-Control", "no-cache")
			w.Header().Set("ETag", etag)

			if match := r.Header.Get("If-None-Match"); match == etag {
				w.WriteHeader(http.StatusNotModified)
				return
			}

			w.Write(asset.data)
		}
	}

	mux.HandleFunc("/", serveAsset("index.html"))
	mux.HandleFunc("/styles.css", serveAsset("styles.css"))
	mux.HandleFunc("/app-shell.js", serveAsset("app-shell.js"))

	// Returns basic manifest data immediately (no compilation required).
	mux.HandleFunc("/api/data", func(w http.ResponseWriter, r *http.Request) {
		stateMu.RLock()
		payload := currentJSON
		stateMu.RUnlock()

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache")
		w.Write(payload)
	})

	mux.HandleFunc("/api/refresh", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		newManifest, err := rediscoverManifest()
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		newTemplates := templates.ListAllTemplates(newManifest.Registries)
		newData := collectBasicData(newManifest, version, newTemplates)
		newJSON, err := json.Marshal(newData)
		if err != nil {
			http.Error(w, "failed to marshal refreshed docs data", http.StatusInternalServerError)
			return
		}
		newRegistry := buildTemplateRegistry(newTemplates)

		newAllowedTargets := map[string]bool{}
		for _, t := range newData.InstallTargets {
			newAllowedTargets[filepath.Clean(t.Path)] = true
		}

		stateMu.Lock()
		currentManifest = newManifest
		currentData = newData
		currentJSON = newJSON
		currentRegistry = newRegistry
		allowedInstallTargets = newAllowedTargets
		stateMu.Unlock()

		sseClientsMu.Lock()
		sseHistory = nil
		sseClientsMu.Unlock()

		startMetaCollection(newManifest)

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache")
		w.Write(newJSON)
	})

	handleRegistrySearch := func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		q := strings.TrimSpace(r.URL.Query().Get("q"))
		source := strings.TrimSpace(r.URL.Query().Get("source"))
		offset := clampParseInt(r.URL.Query().Get("offset"), 0, 0, 1_000_000)
		limit := clampParseInt(r.URL.Query().Get("limit"), 50, 1, 200)

		stateMu.RLock()
		current := currentRegistry
		stateMu.RUnlock()

		total, items := current.Search(q, source, offset, limit)
		resp := struct {
			Total   int                   `json:"total"`
			Offset  int                   `json:"offset"`
			Limit   int                   `json:"limit"`
			HasMore bool                  `json:"hasMore"`
			Items   []DocTemplateSummary  `json:"items"`
		}{
			Total: total,
			Offset: offset,
			Limit: limit,
			HasMore: offset+len(items) < total,
			Items: items,
		}

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache")
		_ = json.NewEncoder(w).Encode(resp)
	}
	mux.HandleFunc("/api/registry/search", handleRegistrySearch)

	handleRegistryTemplate := func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		id := strings.TrimSpace(r.URL.Query().Get("id"))
		if id == "" {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}

		stateMu.RLock()
		current := currentRegistry
		stateMu.RUnlock()

		tpl, ok := current.ByID(id)
		if !ok {
			http.Error(w, "template not found", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache")
		_ = json.NewEncoder(w).Encode(tpl)
	}
	mux.HandleFunc("/api/registry/template", handleRegistryTemplate)

	mux.HandleFunc("/api/templates/install", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			Template    string `json:"template"`
			CommandName string `json:"commandName"`
			Language    string `json:"language"`
			TargetPath  string `json:"targetPath"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		template := strings.TrimSpace(req.Template)
		commandName := strings.TrimSpace(req.CommandName)
		if template == "" || commandName == "" {
			http.Error(w, "template and commandName are required", http.StatusBadRequest)
			return
		}

		stateMu.RLock()
		installTargets := currentData.InstallTargets
		allowedTargets := allowedInstallTargets
		stateMu.RUnlock()

		targetPath := strings.TrimSpace(req.TargetPath)
		if targetPath == "" {
			if len(installTargets) == 1 {
				targetPath = installTargets[0].Path
			} else {
				http.Error(w, "targetPath is required when multiple install targets exist", http.StatusBadRequest)
				return
			}
		}

		targetPath = filepath.Clean(targetPath)
		if !allowedTargets[targetPath] {
			http.Error(w, "targetPath is not an allowed forge target", http.StatusBadRequest)
			return
		}

		lang := strings.TrimSpace(strings.ToLower(req.Language))
		if lang != "" && lang != "go" && lang != "ts" && lang != "cs" {
			http.Error(w, "language must be one of go, ts, cs", http.StatusBadRequest)
			return
		}

		forgeBin, err := os.Executable()
		if err != nil {
			http.Error(w, "cannot locate forge binary", http.StatusInternalServerError)
			return
		}

		args := []string{"add", commandName, "--from", template}
		switch lang {
		case "go":
			args = append(args, "--go")
		case "ts":
			args = append(args, "--ts")
		case "cs":
			args = append(args, "--cs")
		}

		cmd := exec.Command(forgeBin, args...)
		cmd.Dir = targetPath
		output, runErr := cmd.CombinedOutput()

		resp := struct {
			OK      bool   `json:"ok"`
			Message string `json:"message"`
			Output  string `json:"output,omitempty"`
		}{
			OK: runErr == nil,
		}

		if runErr != nil {
			resp.Message = runErr.Error()
			resp.Output = string(output)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(resp)
			return
		}

		resp.Message = "Template installed"
		resp.Output = string(output)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	})

	// SSE endpoint for streaming metadata updates.
	mux.HandleFunc("/api/events", func(w http.ResponseWriter, r *http.Request) {
		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming not supported", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		ch := make(chan []byte, 32)
		sseClientsMu.Lock()
		// Replay event history so this client catches up with events
		// that were broadcast before it connected.
		for _, msg := range sseHistory {
			w.Write(msg)
		}
		flusher.Flush()
		sseClients[ch] = struct{}{}
		sseClientsMu.Unlock()

		defer func() {
			sseClientsMu.Lock()
			delete(sseClients, ch)
			sseClientsMu.Unlock()
		}()

		// Keep connection open until client disconnects.
		ctx := r.Context()
		for {
			select {
			case msg := <-ch:
				w.Write(msg)
				flusher.Flush()
			case <-ctx.Done():
				return
			}
		}
	})

	const (
		idleShutdownAfter = 20 * time.Second
		shutdownGrace     = 3 * time.Second
	)

	var activityMu sync.Mutex
	lastPing := time.Now()
	shutdownRequestedAt := time.Time{}

	markPing := func() {
		activityMu.Lock()
		lastPing = time.Now()
		shutdownRequestedAt = time.Time{}
		activityMu.Unlock()
	}

	requestShutdown := func() {
		activityMu.Lock()
		shutdownRequestedAt = time.Now()
		activityMu.Unlock()
	}

	mux.HandleFunc("/api/ping", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		markPing()
		w.WriteHeader(http.StatusOK)
	})

	// Track the currently running process for kill support.
	var (
		runMu      sync.Mutex
		runCmd     *exec.Cmd
		runCancel  context.CancelFunc
		runActive  bool
	)

	// Run a command and stream its output.
	mux.HandleFunc("/api/run", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			Command string   `json:"command"`
			Args    []string `json:"args"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		stateMu.RLock()
		activeManifest := currentManifest
		stateMu.RUnlock()

		if _, ok := activeManifest.Commands[req.Command]; !ok {
			http.Error(w, "unknown command: "+req.Command, http.StatusNotFound)
			return
		}

		runMu.Lock()
		if runActive {
			runMu.Unlock()
			http.Error(w, "a command is already running", http.StatusConflict)
			return
		}
		runActive = true
		runMu.Unlock()

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming not supported", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("X-Content-Type-Options", "nosniff")

		// Get the forge binary path.
		forgeBin, err := os.Executable()
		if err != nil {
			runMu.Lock()
			runActive = false
			runMu.Unlock()
			http.Error(w, "cannot find forge binary", http.StatusInternalServerError)
			return
		}

		cmdCtx, cmdCancel := context.WithCancel(r.Context())
		cmdArgs := append([]string{req.Command}, req.Args...)
		cmd := exec.CommandContext(cmdCtx, forgeBin, cmdArgs...)

		fallbackRunDir := resolveManifestRunCwd(activeManifest)
		if cmdDef, ok := activeManifest.Commands[req.Command]; ok {
			cmd.Dir = resolveCommandRunCwd(cmdDef, fallbackRunDir)
		} else {
			cmd.Dir = fallbackRunDir
		}

		// Merge stdout and stderr.
		pr, pw := io.Pipe()
		cmd.Stdout = pw
		cmd.Stderr = pw

		runMu.Lock()
		runCmd = cmd
		runCancel = cmdCancel
		runMu.Unlock()

		if err := cmd.Start(); err != nil {
			pw.Close()
			pr.Close()
			cmdCancel()
			runMu.Lock()
			runCmd = nil
			runCancel = nil
			runActive = false
			runMu.Unlock()
			fmt.Fprintf(w, "error starting command: %v\n", err)
			flusher.Flush()
			return
		}

		// Stream output line by line.
		go func() {
			cmd.Wait()
			pw.Close()
		}()

		scanner := bufio.NewScanner(pr)
		for scanner.Scan() {
			fmt.Fprintf(w, "%s\n", scanner.Text())
			flusher.Flush()
		}
		pr.Close()

		// Write exit status.
		exitCode := 0
		if cmd.ProcessState != nil && !cmd.ProcessState.Success() {
			exitCode = cmd.ProcessState.ExitCode()
		}
		fmt.Fprintf(w, "\n\x1b[exit:%d]\n", exitCode)
		flusher.Flush()

		cmdCancel()
		runMu.Lock()
		runCmd = nil
		runCancel = nil
		runActive = false
		runMu.Unlock()
	})

	// Kill the currently running process.
	mux.HandleFunc("/api/run/kill", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		runMu.Lock()
		if runCancel != nil {
			runCancel()
		}
		if runCmd != nil && runCmd.Process != nil {
			runCmd.Process.Kill()
		}
		runMu.Unlock()

		w.WriteHeader(http.StatusOK)
	})

	server := &http.Server{Handler: mux}

	go func() {
		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()

		for range ticker.C {
			now := time.Now()

			activityMu.Lock()
			idleFor := now.Sub(lastPing)
			shutdownAt := shutdownRequestedAt
			activityMu.Unlock()

			if idleFor >= idleShutdownAfter {
				server.Shutdown(context.Background())
				return
			}

			if !shutdownAt.IsZero() && now.Sub(shutdownAt) >= shutdownGrace && idleFor >= shutdownGrace {
				server.Shutdown(context.Background())
				return
			}
		}
	}()

	// Legacy endpoint retained for compatibility; shutdown is now graceful.
	mux.HandleFunc("/api/shutdown", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		requestShutdown()
		w.WriteHeader(http.StatusOK)
	})

	defer func() {
		metaMu.Lock()
		if metaCancel != nil {
			metaCancel()
		}
		metaMu.Unlock()
	}()

	fmt.Printf("\033[36mforge tasks\033[0m serving at %s\n", url)

	// Open in chromeless app window.
	openAppWindow(url)

	// Serve until shutdown.
	if err := server.Serve(listener); err != http.ErrServerClosed {
		return fmt.Errorf("server error: %w", err)
	}

	return nil
}

func rediscoverManifest() (*manifest.Manifest, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return nil, fmt.Errorf("could not get working directory: %w", err)
	}

	upward, err := manifest.DiscoverScripts(cwd)
	if err != nil {
		return nil, err
	}

	downward, err := manifest.DiscoverScriptsDown(cwd)
	if err != nil {
		return nil, err
	}

	if len(upward) == 0 && len(downward) == 0 {
		return nil, fmt.Errorf("no .forge/scripts/ found in current, parent, or child directories")
	}

	all := append(downward, upward...)

	return manifest.Merge(all), nil
}

// collectBasicData builds command docs from manifest data alone (no compilation).
// Script commands will have empty positionals/flags until meta is streamed.
func collectBasicData(m *manifest.Manifest, version string, allTemplates []templates.TemplateInfo) DocData {
	data := DocData{
		ProjectName: detectProjectName(m),
		Version:     version,
	}

	cwd := resolveManifestRunCwd(m)
	data.RunCwd = cwd

	names := make([]string, 0, len(m.Commands))
	for name := range m.Commands {
		names = append(names, name)
	}
	sortStrings(names)

	for _, name := range names {
		cmd := m.Commands[name]
		doc := DocCommand{
			Name:        name,
			Description: cmd.Description,
			Source:      commandSource(cmd.ManifestDir, cwd),
			RunPath:     resolveCommandRunCwd(cmd, cwd),
			SourcePath:  filepath.Join(cmd.ManifestDir, manifest.ForgeDirName, manifest.ScriptsDirName),
		}

		if len(cmd.Run) > 0 {
			doc.CommandType = "composite"
			for _, step := range cmd.Run {
				s := DocStep{}
				if len(step.Parallel) > 0 {
					s.Parallel = step.Parallel
				} else {
					s.Command = step.Command
					if len(step.Args) > 0 {
						s.Args = step.Args
					}
				}
				doc.Steps = append(doc.Steps, s)
			}
		} else {
			doc.CommandType = "script"
			doc.Script = cmd.Script
			doc.Language = detectLanguage(cmd.Script)
		}

		// Read example.md from the script's directory if it exists.
		if cmd.Script != "" {
			scriptPath := cmd.Script
			if !filepath.IsAbs(scriptPath) {
				scriptPath = filepath.Join(cmd.ManifestDir, scriptPath)
			}
			doc.ScriptPath = filepath.Clean(scriptPath)
			examplePath := filepath.Join(filepath.Dir(scriptPath), "example.md")
			if content, err := os.ReadFile(examplePath); err == nil {
				doc.Example = string(content)
			}
		}

		data.Commands = append(data.Commands, doc)
	}

	data.TemplateCount = len(allTemplates)
	sourceCounts := map[string]DocRegistrySource{}
	for _, t := range allTemplates {
		entry := sourceCounts[t.Source]
		entry.Name = t.Source
		entry.Count++
		if entry.SourceType == "" {
			entry.SourceType = docSourceTypeLabel(t.SourceType)
		}
		sourceCounts[t.Source] = entry
	}
	for _, v := range sourceCounts {
		data.RegistrySources = append(data.RegistrySources, v)
	}
	if len(data.RegistrySources) > 0 {
		sort.Slice(data.RegistrySources, func(i, j int) bool {
			return data.RegistrySources[i].Name < data.RegistrySources[j].Name
		})
	}

	data.InstallTargets = collectInstallTargets()

	return data
}

func resolveManifestRunCwd(m *manifest.Manifest) string {
	if cwd, err := os.Getwd(); err == nil && strings.TrimSpace(cwd) != "" {
		if abs, absErr := filepath.Abs(cwd); absErr == nil {
			return filepath.Clean(abs)
		}

		return filepath.Clean(cwd)
	}

	if m != nil {
		if strings.TrimSpace(m.ManifestDir) != "" {
			if abs, absErr := filepath.Abs(m.ManifestDir); absErr == nil {
				return filepath.Clean(abs)
			}

			return filepath.Clean(m.ManifestDir)
		}

		for _, cmd := range m.Commands {
			if strings.TrimSpace(cmd.ManifestDir) == "" {
				continue
			}

			if abs, absErr := filepath.Abs(cmd.ManifestDir); absErr == nil {
				return filepath.Clean(abs)
			}

			return filepath.Clean(cmd.ManifestDir)
		}
	}

	return "."
}

func resolveCommandRunCwd(cmd manifest.Command, fallback string) string {
	runDir := strings.TrimSpace(cmd.ManifestDir)
	if runDir == "" {
		runDir = strings.TrimSpace(fallback)
	}

	if runDir == "" {
		runDir = "."
	}

	if abs, err := filepath.Abs(runDir); err == nil {
		return filepath.Clean(abs)
	}

	return filepath.Clean(runDir)
}

func docSourceTypeLabel(sourceType string) string {
	switch strings.TrimSpace(sourceType) {
	case "built-in":
		return "built-in"
	case "github-git":
		return "github-git"
	case "local-git":
		return "local-git"
	case "folder-index":
		return "folder-index"
	case "folder-scan":
		return "folder-scan"
	default:
		return ""
	}
}

func collectInstallTargets() []DocInstallTarget {
	cwd, err := os.Getwd()
	if err != nil {
		return nil
	}

	targets := map[string]DocInstallTarget{}

	addTarget := func(dir string) {
		if strings.TrimSpace(dir) == "" {
			return
		}

		clean := filepath.Clean(dir)
		if _, exists := targets[clean]; exists {
			return
		}

		rel, relErr := filepath.Rel(cwd, clean)
		label := clean
		if relErr == nil {
			if rel == "." {
				label = "current directory"
			} else {
				label = rel
			}
		}

		targets[clean] = DocInstallTarget{
			Path:  clean,
			Label: label,
		}
	}

	if scriptManifests, err := manifest.DiscoverScripts(cwd); err == nil {
		for _, m := range scriptManifests {
			for _, c := range m.Commands {
				addTarget(c.ManifestDir)
			}
		}
	}

	if scriptManifests, err := manifest.DiscoverScriptsDown(cwd); err == nil {
		for _, m := range scriptManifests {
			for _, c := range m.Commands {
				addTarget(c.ManifestDir)
			}
		}
	}

	_ = filepath.WalkDir(cwd, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return nil
		}
		if !entry.IsDir() {
			return nil
		}

		switch entry.Name() {
		case ".git", "node_modules", "bin", "obj", "cache":
			if path != cwd {
				return filepath.SkipDir
			}
		}

		forgeDir := filepath.Join(path, manifest.ForgeDirName)
		if info, statErr := os.Stat(forgeDir); statErr == nil && info.IsDir() {
			addTarget(path)
		}

		return nil
	})

	if len(targets) == 0 {
		addTarget(cwd)
	}

	keys := make([]string, 0, len(targets))
	for k := range targets {
		keys = append(keys, k)
	}
	sortStrings(keys)

	result := make([]DocInstallTarget, 0, len(keys))
	for _, k := range keys {
		result = append(result, targets[k])
	}

	return result
}

// MetaUpdate is sent via SSE when a script's metadata has been collected.
type MetaUpdate struct {
	Name        string   `json:"name"`
	Status      string   `json:"status"` // "compiling", "ready", "error"
	Positionals []DocArg `json:"positionals,omitempty"`
	Flags       []DocArg `json:"flags,omitempty"`
	Description string   `json:"description,omitempty"`
}

// collectAndStream runs --forge-meta on each script command and broadcasts
// SSE events as each one completes. Sends a "done" event when finished.
func collectAndStream(ctx context.Context, m *manifest.Manifest, broadcast func(string, []byte)) {
	if ctx.Err() != nil {
		return
	}

	names := make([]string, 0, len(m.Commands))
	for name := range m.Commands {
		cmd := m.Commands[name]
		if cmd.Script != "" {
			names = append(names, name)
		}
	}
	sortStrings(names)

	if len(names) == 0 {
		if ctx.Err() != nil {
			return
		}
		doneJSON, _ := json.Marshal(map[string]int{"total": 0})
		broadcast("done", doneJSON)
		return
	}

	// Notify the client which scripts are being compiled.
	for _, name := range names {
		if ctx.Err() != nil {
			return
		}
		update := MetaUpdate{Name: name, Status: "compiling"}
		data, _ := json.Marshal(update)
		broadcast("meta", data)
	}

	// Pre-run shared setup for each language so parallel Meta() calls
	// don't race on writing the same cached files (helpers, package.json, etc).
	for _, name := range names {
		if ctx.Err() != nil {
			return
		}
		cmd := m.Commands[name]
		scriptPath := cmd.Script
		if !filepath.IsAbs(scriptPath) {
			scriptPath = filepath.Join(cmd.ManifestDir, scriptPath)
		}
		ext := strings.ToLower(filepath.Ext(scriptPath))
		if ext == ".ts" {
			runner.PrepareTs(scriptPath, cmd.ManifestDir)
			break // Only need to prepare once — all TS scripts share the same helpers.
		}
	}

	// Collect in parallel, broadcasting each result as it arrives.
	var wg sync.WaitGroup
	for _, name := range names {
		wg.Add(1)
		go func(n string, cmd manifest.Command) {
			defer wg.Done()

			if ctx.Err() != nil {
				return
			}

			meta, err := runner.Meta(cmd, m)
			if ctx.Err() != nil {
				return
			}

			update := MetaUpdate{Name: n}
			if err != nil || meta == nil {
				update.Status = "ready" // No meta available — mark as done anyway.
			} else {
				update.Status = "ready"
				enrichMetaUpdate(&update, meta)
			}

			data, _ := json.Marshal(update)
			broadcast("meta", data)
		}(name, m.Commands[name])
	}

	wg.Wait()
	if ctx.Err() != nil {
		return
	}

	doneJSON, _ := json.Marshal(map[string]int{"total": len(names)})
	broadcast("done", doneJSON)
}

// enrichMetaUpdate parses --forge-meta JSON into a MetaUpdate.
func enrichMetaUpdate(update *MetaUpdate, meta []byte) {
	var parsed struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Args        []struct {
			Name        string `json:"name"`
			Type        string `json:"type"`
			Description string `json:"description"`
			Positional  bool   `json:"positional"`
			Required    bool   `json:"required"`
			Default     string `json:"default"`
		} `json:"args"`
	}

	if err := json.Unmarshal(meta, &parsed); err != nil {
		return
	}

	update.Description = parsed.Description

	for _, a := range parsed.Args {
		arg := DocArg{
			Name:         a.Name,
			Type:         a.Type,
			Description:  a.Description,
			Required:     a.Required,
			DefaultValue: a.Default,
		}
		if a.Positional {
			update.Positionals = append(update.Positionals, arg)
		} else {
			update.Flags = append(update.Flags, arg)
		}
	}
}

// detectLanguage returns the language name based on script file extension.
func detectLanguage(script string) string {
	switch strings.ToLower(filepath.Ext(script)) {
	case ".go":
		return "Go"
	case ".ts":
		return "TypeScript"
	case ".cs":
		return "C#"
	default:
		return ""
	}
}

// commandSource returns a human-readable label indicating where a command is
// defined. If the command is from the current working directory it returns
// "local"; for child directories it returns the relative path (e.g.
// "subfolder/super-nested"); for parent directories it returns the base name.
func commandSource(manifestDir, cwd string) string {
	if manifestDir == "" || cwd == "" {
		return ""
	}

	clean := filepath.Clean(manifestDir)
	cwdClean := filepath.Clean(cwd)

	if strings.EqualFold(clean, cwdClean) {
		return "local"
	}

	// Try relative path — if it doesn't start with ".." the manifest
	// is in a subdirectory of the working directory.
	rel, err := filepath.Rel(cwdClean, clean)
	if err == nil && !strings.HasPrefix(rel, "..") {
		return filepath.ToSlash(rel)
	}

	return filepath.Base(clean)
}

// detectProjectName uses the current working directory to derive a
// human-readable project name for the docs header.
func detectProjectName(m *manifest.Manifest) string {
	if cwd, err := os.Getwd(); err == nil {
		return filepath.Base(cwd)
	}

	return "forge"
}

// openAppWindow tries to open the URL in a chromeless app window using
// Edge/Chrome's --app flag (which uses WebView2 on Windows). Falls back
// to the default browser if no suitable browser is found.
func openAppWindow(url string) {
	// Try browsers that support --app mode (chromeless window).
	// Edge is guaranteed on Windows 10+; Chrome/Chromium on all platforms.
	candidates := appBrowserCandidates()

	for _, browser := range candidates {
		// Try LookPath first (for browsers on PATH), then treat as absolute path.
		path, err := exec.LookPath(browser)
		if err != nil {
			// Check if the candidate is an absolute path that exists.
			if filepath.IsAbs(browser) {
				if _, statErr := os.Stat(browser); statErr == nil {
					path = browser
				} else {
					continue
				}
			} else {
				continue
			}
		}
		// Use a fixed user-data-dir so Chrome/Edge doesn't restore
		// a previous window size from its session cache.
		dataDir := filepath.Join(os.TempDir(), "forge-docs-profile")
		cmd := exec.Command(path,
			"--app="+url,
			"--window-size=1280,900",
			"--user-data-dir="+dataDir,
		)
		if cmd.Start() == nil {
			// Clean up profile dir when the browser process exits.
			go func() {
				cmd.Wait()
				os.RemoveAll(dataDir)
			}()
			return
		}
	}

	// Fallback to default browser.
	openBrowserFallback(url)
}

// appBrowserCandidates returns browser executables that support --app mode,
// ordered by preference per platform.
func appBrowserCandidates() []string {
	switch runtime.GOOS {
	case "windows":
		return []string{
			"chrome",
			`C:\Program Files\Google\Chrome\Application\chrome.exe`,
			`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`,
			"chromium",
			"msedge",
			`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`,
			`C:\Program Files\Microsoft\Edge\Application\msedge.exe`,
		}
	case "darwin":
		return []string{
			"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
			"/Applications/Chromium.app/Contents/MacOS/Chromium",
			"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
		}
	case "linux":
		return []string{
			"google-chrome",
			"google-chrome-stable",
			"chromium",
			"chromium-browser",
			"microsoft-edge",
		}
	default:
		return nil
	}
}

// openBrowserFallback opens the URL with the OS default browser.
func openBrowserFallback(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "linux":
		cmd = exec.Command("xdg-open", url)
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", url)
	default:
		return
	}
	cmd.Start()
}

func requestExistingDocsShutdown(port int) {
	client := &http.Client{Timeout: 2 * time.Second}
	req, err := http.NewRequest(http.MethodPost, fmt.Sprintf("http://127.0.0.1:%d/api/shutdown", port), nil)
	if err != nil {
		return
	}

	resp, err := client.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)
}

func waitForDocsListener(port int, timeout time.Duration) (net.Listener, error) {
	deadline := time.Now().Add(timeout)
	address := fmt.Sprintf("127.0.0.1:%d", port)
	var lastErr error

	for time.Now().Before(deadline) {
		listener, err := net.Listen("tcp", address)
		if err == nil {
			return listener, nil
		}

		lastErr = err
		time.Sleep(200 * time.Millisecond)
	}

	if lastErr == nil {
		lastErr = fmt.Errorf("timeout waiting for %s", address)
	}

	return nil, lastErr
}

func sortStrings(s []string) {
	for i := 1; i < len(s); i++ {
		for j := i; j > 0 && s[j] < s[j-1]; j-- {
			s[j], s[j-1] = s[j-1], s[j]
		}
	}
}
