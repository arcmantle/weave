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
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/arcmantle/forge/internal/manifest"
	"github.com/arcmantle/forge/internal/runner"
)

//go:embed index.html styles.css utils.js markdown.js runner.js forge-sidebar.js forge-command.js app.js
var staticFiles embed.FS

// DocData is the top-level JSON structure injected into the HTML template.
type DocData struct {
	ProjectName string       `json:"projectName"`
	Version     string       `json:"version"`
	Commands    []DocCommand `json:"commands"`
}

// DocCommand represents a single command's documentation.
type DocCommand struct {
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CommandType string    `json:"commandType"` // "script" or "composite"
	Source      string    `json:"source,omitempty"`
	Script      string    `json:"script,omitempty"`
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
	// Build basic data from manifest (instant — no compilation).
	basicData := collectBasicData(m, version)
	basicJSON, err := json.Marshal(basicData)
	if err != nil {
		return fmt.Errorf("marshaling basic data: %w", err)
	}

	// Find an available port.
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return fmt.Errorf("finding available port: %w", err)
	}

	port := listener.Addr().(*net.TCPAddr).Port
	url := fmt.Sprintf("http://127.0.0.1:%d", port)

	// Heartbeat tracking for auto-close.
	var (
		mu       sync.Mutex
		lastPing = time.Now()
	)

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

	// Collect metadata in background, broadcasting each result via SSE.
	go func() {
		collectAndStream(m, broadcast)
	}()

	mux := http.NewServeMux()

	// Serve embedded static files with ETag caching.
	type staticAsset struct {
		data        []byte
		contentType string
	}

	assets := map[string]staticAsset{}
	for _, entry := range []struct {
		path        string
		contentType string
	}{
		{"index.html", "text/html; charset=utf-8"},
		{"styles.css", "text/css; charset=utf-8"},
		{"utils.js", "application/javascript; charset=utf-8"},
		{"markdown.js", "application/javascript; charset=utf-8"},
		{"runner.js", "application/javascript; charset=utf-8"},
		{"forge-sidebar.js", "application/javascript; charset=utf-8"},
		{"forge-command.js", "application/javascript; charset=utf-8"},
		{"app.js", "application/javascript; charset=utf-8"},
	} {
		data, _ := staticFiles.ReadFile(entry.path)
		assets[entry.path] = staticAsset{data: data, contentType: entry.contentType}
	}

	// Compute a combined ETag from all static assets.
	h := sha256.New()
	for _, name := range []string{"index.html", "styles.css", "utils.js", "markdown.js", "runner.js", "forge-sidebar.js", "forge-command.js", "app.js"} {
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
	mux.HandleFunc("/utils.js", serveAsset("utils.js"))
	mux.HandleFunc("/markdown.js", serveAsset("markdown.js"))
	mux.HandleFunc("/runner.js", serveAsset("runner.js"))
	mux.HandleFunc("/forge-sidebar.js", serveAsset("forge-sidebar.js"))
	mux.HandleFunc("/forge-command.js", serveAsset("forge-command.js"))
	mux.HandleFunc("/app.js", serveAsset("app.js"))

	// Returns basic manifest data immediately (no compilation required).
	mux.HandleFunc("/api/data", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache")
		w.Write(basicJSON)
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

	mux.HandleFunc("/api/ping", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		mu.Lock()
		lastPing = time.Now()
		mu.Unlock()
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

		if _, ok := m.Commands[req.Command]; !ok {
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

		// Set working directory to where forge was originally invoked.
		if wd, wdErr := os.Getwd(); wdErr == nil {
			cmd.Dir = wd
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

	// Shutdown on explicit tab-close signal.
	server := &http.Server{Handler: mux}
	mux.HandleFunc("/api/shutdown", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.WriteHeader(http.StatusOK)
		go func() {
			time.Sleep(200 * time.Millisecond)
			server.Shutdown(context.Background())
		}()
	})

	// Shutdown context — cancelled when heartbeat expires.
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Monitor heartbeat in background.
	go func() {
		ticker := time.NewTicker(3 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				mu.Lock()
				elapsed := time.Since(lastPing)
				mu.Unlock()
				if elapsed > 8*time.Second {
					cancel()
					server.Shutdown(context.Background())
					return
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	fmt.Printf("\033[36mforge docs\033[0m serving at %s\n", url)
	fmt.Println("The server will stop when you close the browser tab.")

	// Open in chromeless app window.
	openAppWindow(url)

	// Serve until shutdown.
	if err := server.Serve(listener); err != http.ErrServerClosed {
		return fmt.Errorf("server error: %w", err)
	}

	fmt.Println("\nBrowser tab closed — shutting down.")

	return nil
}

// collectBasicData builds command docs from manifest data alone (no compilation).
// Script commands will have empty positionals/flags until meta is streamed.
func collectBasicData(m *manifest.Manifest, version string) DocData {
	data := DocData{
		ProjectName: detectProjectName(m),
		Version:     version,
	}

	cwd, _ := os.Getwd()

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
			examplePath := filepath.Join(filepath.Dir(scriptPath), "example.md")
			if content, err := os.ReadFile(examplePath); err == nil {
				doc.Example = string(content)
			}
		}

		data.Commands = append(data.Commands, doc)
	}

	return data
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
func collectAndStream(m *manifest.Manifest, broadcast func(string, []byte)) {
	names := make([]string, 0, len(m.Commands))
	for name := range m.Commands {
		cmd := m.Commands[name]
		if cmd.Script != "" {
			names = append(names, name)
		}
	}
	sortStrings(names)

	if len(names) == 0 {
		doneJSON, _ := json.Marshal(map[string]int{"total": 0})
		broadcast("done", doneJSON)
		return
	}

	// Notify the client which scripts are being compiled.
	for _, name := range names {
		update := MetaUpdate{Name: name, Status: "compiling"}
		data, _ := json.Marshal(update)
		broadcast("meta", data)
	}

	// Pre-run shared setup for each language so parallel Meta() calls
	// don't race on writing the same cached files (helpers, package.json, etc).
	for _, name := range names {
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

			meta, err := runner.Meta(cmd, m)

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
// "local"; otherwise it returns the base directory name of the manifest.
func commandSource(manifestDir, cwd string) string {
	if manifestDir == "" || cwd == "" {
		return ""
	}

	clean := filepath.Clean(manifestDir)
	cwdClean := filepath.Clean(cwd)

	if strings.EqualFold(clean, cwdClean) {
		return "local"
	}

	return filepath.Base(clean)
}

// detectProjectName tries to derive a project name from the manifest directory.
func detectProjectName(m *manifest.Manifest) string {
	for _, cmd := range m.Commands {
		if cmd.ManifestDir != "" {
			return filepath.Base(cmd.ManifestDir)
		}
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

func sortStrings(s []string) {
	for i := 1; i < len(s); i++ {
		for j := i; j > 0 && s[j] < s[j-1]; j-- {
			s[j], s[j-1] = s[j-1], s[j]
		}
	}
}
