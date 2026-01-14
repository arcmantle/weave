package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/arcmantle/weave/packages/pivot-go/core"
	"github.com/fsnotify/fsnotify"
)

func main() {
	logger := log.New(os.Stdout, "[SampleServer] ", log.LstdFlags)

	port := flag.Int("port", 5001, "Port to listen on")
	flag.Parse()

	// Configure server using Pivot framework
	pluginDir := "./plugins"
	coordinatorURL := os.Getenv("PIVOT_COORDINATOR_URL")

	logger.Printf("Plugin directory: %s", pluginDir)
	logger.Printf("Coordinator URL: %s", coordinatorURL)

	// Load plugins using Pivot's PluginLoader
	loader := core.NewPluginLoader(logger)
	if err := loader.LoadFromDirectory(pluginDir); err != nil {
		logger.Printf("Failed to load plugins: %v", err)
	}

	// Setup HTTP server
	mux := http.NewServeMux()

	// Health endpoint
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
	})

	// Welcome endpoint
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		response := map[string]interface{}{
			"message": "Welcome to Sample Pivot Application!",
			"port":    *port,
			"plugins": len(loader.GetPlugins()),
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	})

	// Register all plugins using Pivot's loader
	loader.RegisterAll(mux)

	// Start file watcher if coordinator URL is set (auto-reload enabled)
	if coordinatorURL != "" {
		go watchPlugins(logger, pluginDir, coordinatorURL)
	}

	addr := fmt.Sprintf(":%d", *port)
	logger.Printf("Sample Server listening on %s", addr)
	logger.Printf("Loaded %d plugin(s)", len(loader.GetPlugins()))

	if err := http.ListenAndServe(addr, mux); err != nil {
		logger.Fatal(err)
	}
}

func watchPlugins(logger *log.Logger, pluginDir, coordinatorURL string) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		logger.Printf("Failed to create file watcher: %v", err)
		return
	}
	defer watcher.Close()

	if err := watcher.Add(pluginDir); err != nil {
		logger.Printf("Failed to watch plugin directory: %v", err)
		return
	}

	logger.Printf("Watching plugin directory: %s", pluginDir)

	var debounceTimer *time.Timer
	debounce := 500 * time.Millisecond

	for {
		select {
		case event, ok := <-watcher.Events:
			if !ok {
				return
			}

			if filepath.Ext(event.Name) == ".so" {
				logger.Printf("Plugin file changed: %s", event.Name)

				if debounceTimer != nil {
					debounceTimer.Stop()
				}
				debounceTimer = time.AfterFunc(debounce, func() {
					triggerReload(logger, coordinatorURL)
				})
			}

		case err, ok := <-watcher.Errors:
			if !ok {
				return
			}
			logger.Printf("File watcher error: %v", err)
		}
	}
}

func triggerReload(logger *log.Logger, coordinatorURL string) {
	logger.Println("Triggering reload via coordinator")

	url := fmt.Sprintf("%s/reload", coordinatorURL)
	resp, err := http.Post(url, "application/json", bytes.NewBuffer([]byte("{}")))
	if err != nil {
		logger.Printf("Failed to trigger reload: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusAccepted {
		logger.Println("Reload triggered successfully")
	} else {
		logger.Printf("Reload request failed with status: %d", resp.StatusCode)
	}
}
