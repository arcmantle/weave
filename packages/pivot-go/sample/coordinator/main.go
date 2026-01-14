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
	logger := log.New(os.Stdout, "[SampleCoordinator] ", log.LstdFlags)

	// Configure the coordinator
	options := &core.CoordinatorOptions{
		ServerBinaryPath:       "../server/server",
		InitialPort:            5001,
		HealthCheckMaxAttempts: 30,
		HealthCheckIntervalMs:  500,
		TrafficDrainDelayMs:    5000,
		ShutdownDrainTimeMs:    5000,
	}

	// Create registry and orchestrator using Pivot framework
	registry := orchestration.NewBackendRegistry()
	orchestrator := orchestration.NewBackendOrchestrator(logger, options, registry)

	// Get coordinator address
	port := 5100
	coordinatorURL := fmt.Sprintf("http://localhost:%d", port)
	orchestrator.SetCoordinatorAddress(coordinatorURL)

	// Start orchestrator
	go func() {
		if err := orchestrator.Start(); err != nil {
			logger.Printf("Failed to start orchestrator: %v", err)
			os.Exit(1)
		}
	}()

	// Setup HTTP server with Pivot's endpoints
	router := mux.NewRouter()

	router.HandleFunc("/backends", func(w http.ResponseWriter, r *http.Request) {
		backends := registry.GetAll()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(backends)
	}).Methods("GET")

	router.HandleFunc("/backends/stream", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
			return
		}

		changes := registry.Subscribe()
		defer registry.Unsubscribe(changes)

		backends := registry.GetAll()
		data, _ := json.Marshal(backends)
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()

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

	router.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
	}).Methods("GET")

	addr := fmt.Sprintf(":%d", port)
	logger.Printf("Sample Coordinator listening on %s", addr)
	logger.Printf("Server binary: %s", options.ServerBinaryPath)
	if err := http.ListenAndServe(addr, router); err != nil {
		logger.Fatal(err)
	}
}
