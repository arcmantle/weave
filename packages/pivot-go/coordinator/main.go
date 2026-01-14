package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/arcmantle/weave/packages/pivot-go/core"
	"github.com/arcmantle/weave/packages/pivot-go/coordinator/orchestration"
	"github.com/gorilla/mux"
)

func main() {
	logger := log.New(os.Stdout, "[Coordinator] ", log.LstdFlags)

	// Parse configuration from environment or use defaults
	options := &core.CoordinatorOptions{
		ServerBinaryPath:       getEnv("SERVER_BINARY_PATH", "../server/server"),
		InitialPort:            getEnvInt("INITIAL_PORT", 5001),
		HealthCheckMaxAttempts: getEnvInt("HEALTH_CHECK_MAX_ATTEMPTS", 30),
		HealthCheckIntervalMs:  getEnvInt("HEALTH_CHECK_INTERVAL_MS", 500),
		TrafficDrainDelayMs:    getEnvInt("TRAFFIC_DRAIN_DELAY_MS", 5000),
		ShutdownDrainTimeMs:    getEnvInt("SHUTDOWN_DRAIN_TIME_MS", 5000),
	}

	registry := orchestration.NewBackendRegistry()
	orchestrator := orchestration.NewBackendOrchestrator(logger, options, registry)

	// Get coordinator address for environment variable
	port := getEnvInt("PORT", 5100)
	coordinatorURL := fmt.Sprintf("http://localhost:%d", port)
	orchestrator.SetCoordinatorAddress(coordinatorURL)

	// Start orchestrator in background
	go func() {
		if err := orchestrator.Start(); err != nil {
			logger.Printf("Failed to start orchestrator: %v", err)
			os.Exit(1)
		}
	}()

	// Setup HTTP server
	router := mux.NewRouter()

	// GET /backends - Returns current list of healthy backends
	router.HandleFunc("/backends", func(w http.ResponseWriter, r *http.Request) {
		backends := registry.GetAll()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(backends)
	}).Methods("GET")

	// GET /backends/stream - SSE stream of backend changes
	router.HandleFunc("/backends/stream", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
			return
		}

		// Subscribe to changes
		changes := registry.Subscribe()
		defer registry.Unsubscribe(changes)

		// Send initial state
		backends := registry.GetAll()
		data, _ := json.Marshal(backends)
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()

		// Stream changes
		for {
			select {
			case <-r.Context().Done():
				return
			case backends := <-changes:
				data, _ := json.Marshal(backends)
				fmt.Fprintf(w, "data: %s\n\n", data)
				flusher.Flush()
			}
		}
	}).Methods("GET")

	// POST /reload - Triggers blue-green deployment
	router.HandleFunc("/reload", func(w http.ResponseWriter, r *http.Request) {
		logger.Println("Reload triggered via API")
		go func() {
			if err := orchestrator.ReloadBackends(); err != nil {
				logger.Printf("Reload failed: %v", err)
			}
		}()
		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(map[string]string{"status": "reload initiated"})
	}).Methods("POST")

	// Health endpoint
	router.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
	}).Methods("GET")

	// Start server
	addr := fmt.Sprintf(":%d", port)
	logger.Printf("Coordinator listening on %s", addr)
	if err := http.ListenAndServe(addr, router); err != nil {
		logger.Fatal(err)
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		var result int
		fmt.Sscanf(value, "%d", &result)
		return result
	}
	return defaultValue
}
