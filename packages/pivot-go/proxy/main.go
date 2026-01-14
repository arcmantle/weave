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

type ProxyServer struct {
	logger         *log.Logger
	options        *core.ProxyOptions
	backends       []core.BackendInfo
	backendsMu     sync.RWMutex
	currentBackend int
}

func main() {
	logger := log.New(os.Stdout, "[Proxy] ", log.LstdFlags)

	options := &core.ProxyOptions{
		CoordinatorURL: getEnv("COORDINATOR_URL", "http://localhost:5100"),
	}

	proxy := &ProxyServer{
		logger:   logger,
		options:  options,
		backends: make([]core.BackendInfo, 0),
	}

	// Start SSE client to watch coordinator
	go proxy.watchCoordinator()

	// Setup HTTP proxy
	http.HandleFunc("/", proxy.handleProxy)
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
	})

	port := getEnvInt("PORT", 5000)
	addr := fmt.Sprintf(":%d", port)
	logger.Printf("Proxy listening on %s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		logger.Fatal(err)
	}
}

func (ps *ProxyServer) watchCoordinator() {
	ps.logger.Printf("Connecting to coordinator at %s", ps.options.CoordinatorURL)

	for {
		if err := ps.connectToCoordinator(); err != nil {
			ps.logger.Printf("Error connecting to coordinator: %v, retrying in 2s", err)
			time.Sleep(2 * time.Second)
		}
	}
}

func (ps *ProxyServer) connectToCoordinator() error {
	url := fmt.Sprintf("%s/backends/stream", ps.options.CoordinatorURL)
	resp, err := http.Get(url)
	if err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	ps.logger.Println("Connected to coordinator SSE stream")

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if len(line) > 6 && line[:6] == "data: " {
			jsonData := line[6:]
			var backends []core.BackendInfo
			if err := json.Unmarshal([]byte(jsonData), &backends); err != nil {
				ps.logger.Printf("Failed to parse backend update: %v", err)
				continue
			}
			ps.updateBackends(backends)
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("scanner error: %w", err)
	}

	ps.logger.Println("Coordinator stream ended")
	return nil
}

func (ps *ProxyServer) updateBackends(backends []core.BackendInfo) {
	ps.backendsMu.Lock()
	defer ps.backendsMu.Unlock()

	ps.backends = backends
	ps.currentBackend = 0
	
	ports := make([]int, len(backends))
	for i, b := range backends {
		ports[i] = b.Port
	}
	ps.logger.Printf("Updated proxy configuration with %d backend(s): %v", len(backends), ports)
}

func (ps *ProxyServer) getNextBackend() *core.BackendInfo {
	ps.backendsMu.RLock()
	defer ps.backendsMu.RUnlock()

	if len(ps.backends) == 0 {
		return nil
	}

	// Simple round-robin
	backend := &ps.backends[ps.currentBackend]
	ps.currentBackend = (ps.currentBackend + 1) % len(ps.backends)
	return backend
}

func (ps *ProxyServer) handleProxy(w http.ResponseWriter, r *http.Request) {
	backend := ps.getNextBackend()
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
		ps.logger.Printf("Proxy error for backend %s: %v", backend.Address, err)
		http.Error(w, "Backend unavailable", http.StatusBadGateway)
	}

	proxy.ServeHTTP(w, r)
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
		if _, err := fmt.Sscanf(value, "%d", &result); err != nil {
			// Invalid integer, return default
			return defaultValue
		}
		return result
	}
	return defaultValue
}
