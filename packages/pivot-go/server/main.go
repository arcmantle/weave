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
	logger := log.New(os.Stdout, "[Server] ", log.LstdFlags)

	// Parse command line flags
	port := flag.Int("port", 5001, "Port to listen on")
	flag.Parse()

	// Setup options
	options := &core.BackendOptions{
		PluginDirectory:  getEnv("PLUGIN_DIRECTORY", "./plugins"),
		EnableAutoReload: getEnv("ENABLE_AUTO_RELOAD", "false") == "true",
		WatchDebounceMs:  500,
		CoordinatorURL:   os.Getenv("PIVOT_COORDINATOR_URL"),
	}

	// Load plugins
	loader := core.NewPluginLoader(logger)
	if err := loader.LoadFromDirectory(options.PluginDirectory); err != nil {
		logger.Printf("Failed to load plugins: %v", err)
	}

	// Setup HTTP server
	mux := http.NewServeMux()

	// Health endpoint
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
	})

	// Default route
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Hello from Backend on port %d!\n", *port)
	})

	// Register all plugins
	loader.RegisterAll(mux)

	// Start file watcher if auto-reload is enabled
	if options.EnableAutoReload && options.CoordinatorURL != "" {
		go watchPlugins(logger, options)
	}

	// Start server
	addr := fmt.Sprintf(":%d", *port)
	logger.Printf("Server listening on %s", addr)
	logger.Printf("Loaded %d plugin(s)", len(loader.GetPlugins()))
	
	if err := http.ListenAndServe(addr, mux); err != nil {
		logger.Fatal(err)
	}
}

func watchPlugins(logger *log.Logger, options *core.BackendOptions) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		logger.Printf("Failed to create file watcher: %v", err)
		return
	}
	defer watcher.Close()

	// Watch plugin directory
	if err := watcher.Add(options.PluginDirectory); err != nil {
		logger.Printf("Failed to watch plugin directory: %v", err)
		return
	}

	logger.Printf("Watching plugin directory: %s", options.PluginDirectory)

	var debounceTimer *time.Timer
	debounce := time.Duration(options.WatchDebounceMs) * time.Millisecond

	for {
		select {
		case event, ok := <-watcher.Events:
			if !ok {
				return
			}

			// Only watch .so files
			if filepath.Ext(event.Name) == ".so" {
				logger.Printf("Plugin file changed: %s", event.Name)

				// Debounce multiple rapid changes
				if debounceTimer != nil {
					debounceTimer.Stop()
				}
				debounceTimer = time.AfterFunc(debounce, func() {
					triggerReload(logger, options.CoordinatorURL)
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

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
