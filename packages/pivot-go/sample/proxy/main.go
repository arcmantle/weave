package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"sync"
	"time"

	"github.com/arcmantle/weave/packages/pivot-go/core"
)

type SampleProxy struct {
	logger         *log.Logger
	coordinatorURL string
	backends       []core.BackendInfo
	backendsMu     sync.RWMutex
	currentBackend int
}

func main() {
	logger := log.New(os.Stdout, "[SampleProxy] ", log.LstdFlags)

	coordinatorURL := "http://localhost:5100"

	proxy := &SampleProxy{
		logger:         logger,
		coordinatorURL: coordinatorURL,
		backends:       make([]core.BackendInfo, 0),
	}

	// Start SSE client using Pivot's approach
	go proxy.watchCoordinator()

	// Setup HTTP proxy
	http.HandleFunc("/", proxy.handleProxy)
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
	})

	port := 5000
	addr := fmt.Sprintf(":%d", port)
	logger.Printf("Sample Proxy listening on %s", addr)
	logger.Printf("Connecting to coordinator at %s", coordinatorURL)
	if err := http.ListenAndServe(addr, nil); err != nil {
		logger.Fatal(err)
	}
}

func (sp *SampleProxy) watchCoordinator() {
	sp.logger.Printf("Connecting to coordinator at %s", sp.coordinatorURL)

	for {
		if err := sp.connectToCoordinator(); err != nil {
			sp.logger.Printf("Error connecting to coordinator: %v, retrying in 2s", err)
			time.Sleep(2 * time.Second)
		}
	}
}

func (sp *SampleProxy) connectToCoordinator() error {
	url := fmt.Sprintf("%s/backends/stream", sp.coordinatorURL)
	resp, err := http.Get(url)
	if err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	sp.logger.Println("Connected to coordinator SSE stream")

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if len(line) > 6 && line[:6] == "data: " {
			jsonData := line[6:]
			var backends []core.BackendInfo
			if err := json.Unmarshal([]byte(jsonData), &backends); err != nil {
				sp.logger.Printf("Failed to parse backend update: %v", err)
				continue
			}
			sp.updateBackends(backends)
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("scanner error: %w", err)
	}

	sp.logger.Println("Coordinator stream ended")
	return nil
}

func (sp *SampleProxy) updateBackends(backends []core.BackendInfo) {
	sp.backendsMu.Lock()
	defer sp.backendsMu.Unlock()

	sp.backends = backends
	sp.currentBackend = 0

	ports := make([]int, len(backends))
	for i, b := range backends {
		ports[i] = b.Port
	}
	sp.logger.Printf("Updated proxy configuration with %d backend(s): %v", len(backends), ports)
}

func (sp *SampleProxy) getNextBackend() *core.BackendInfo {
	sp.backendsMu.RLock()
	defer sp.backendsMu.RUnlock()

	if len(sp.backends) == 0 {
		return nil
	}

	backend := &sp.backends[sp.currentBackend]
	sp.currentBackend = (sp.currentBackend + 1) % len(sp.backends)
	return backend
}

func (sp *SampleProxy) handleProxy(w http.ResponseWriter, r *http.Request) {
	backend := sp.getNextBackend()
	if backend == nil {
		http.Error(w, "No backends available", http.StatusServiceUnavailable)
		return
	}

	target, err := url.Parse(backend.Address)
	if err != nil {
		http.Error(w, "Invalid backend address", http.StatusInternalServerError)
		return
	}

	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		sp.logger.Printf("Proxy error for backend %s: %v", backend.Address, err)
		http.Error(w, "Backend unavailable", http.StatusBadGateway)
	}

	proxy.ServeHTTP(w, r)
}
