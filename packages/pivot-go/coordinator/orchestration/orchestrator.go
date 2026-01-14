package orchestration

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"sync"
	"time"

	"github.com/arcmantle/weave/packages/pivot-go/core"
)

// BackendInstance represents a running backend process
type BackendInstance struct {
	Process *os.Process
	Info    core.BackendInfo
	Command *exec.Cmd
}

// BackendOrchestrator manages backend lifecycle
type BackendOrchestrator struct {
	logger            *log.Logger
	options           *core.CoordinatorOptions
	registry          *BackendRegistry
	instances         []*BackendInstance
	nextPort          int
	coordinatorAddr   string
	deploymentLock    sync.Mutex
}

// NewBackendOrchestrator creates a new orchestrator
func NewBackendOrchestrator(logger *log.Logger, options *core.CoordinatorOptions, registry *BackendRegistry) *BackendOrchestrator {
	return &BackendOrchestrator{
		logger:     logger,
		options:    options,
		registry:   registry,
		instances:  make([]*BackendInstance, 0),
		nextPort:   options.InitialPort,
	}
}

// SetCoordinatorAddress sets the coordinator URL for backends
func (bo *BackendOrchestrator) SetCoordinatorAddress(addr string) {
	bo.coordinatorAddr = addr
}

// Start initializes and starts the first backend instance
func (bo *BackendOrchestrator) Start() error {
	bo.logger.Println("Starting initial backend instance on port", bo.nextPort)

	instance, err := bo.startBackend(bo.nextPort)
	if err != nil {
		return fmt.Errorf("failed to start initial backend: %w", err)
	}
	bo.nextPort++

	// Wait for health check
	if !bo.waitForHealthy(instance) {
		bo.logger.Println("Initial backend failed health checks")
		return fmt.Errorf("initial backend failed to start")
	}

	bo.instances = append(bo.instances, instance)
	bo.updateRegistry()

	bo.logger.Println("Initial backend instance started successfully")
	return nil
}

// ReloadBackends performs blue-green deployment
func (bo *BackendOrchestrator) ReloadBackends() error {
	bo.deploymentLock.Lock()
	defer bo.deploymentLock.Unlock()

	startTime := time.Now()
	bo.logger.Println("Starting backend reload on port", bo.nextPort)

	// Start new backend
	newBackend, err := bo.startBackend(bo.nextPort)
	if err != nil {
		return fmt.Errorf("failed to start new backend: %w", err)
	}
	bo.nextPort++

	// Wait for health check
	if !bo.waitForHealthy(newBackend) {
		bo.logger.Println("New backend failed health checks, aborting reload")
		bo.shutdownBackend(newBackend)
		return fmt.Errorf("new backend failed health checks")
	}

	bo.logger.Println("New backend is healthy, switching traffic")

	// Switch traffic
	if len(bo.instances) > 0 {
		oldBackend := bo.instances[0]
		bo.logger.Printf("Removing old backend on port %d from routing", oldBackend.Info.Port)

		// Update instances list
		bo.instances = []*BackendInstance{newBackend}
		bo.updateRegistry()

		bo.logger.Printf("Traffic switched to new backend on port %d, draining old backend", newBackend.Info.Port)

		// Wait for drain period
		time.Sleep(time.Duration(bo.options.ShutdownDrainTimeMs) * time.Millisecond)

		// Shutdown old backend
		bo.logger.Printf("Shutting down old backend on port %d", oldBackend.Info.Port)
		bo.shutdownBackend(oldBackend)
	} else {
		bo.instances = append(bo.instances, newBackend)
		bo.updateRegistry()
	}

	duration := time.Since(startTime)
	bo.logger.Printf("Backend reload completed successfully in %v", duration)

	return nil
}

// startBackend starts a new backend process
func (bo *BackendOrchestrator) startBackend(port int) (*BackendInstance, error) {
	bo.logger.Printf("Starting backend on port %d", port)

	cmd := exec.Command(bo.options.ServerBinaryPath, fmt.Sprintf("--port=%d", port))
	// Redirect backend output to coordinator's stdout/stderr for unified logging
	// In production, consider using a structured logging approach
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	
	// Set coordinator URL environment variable
	cmd.Env = append(os.Environ(), fmt.Sprintf("PIVOT_COORDINATOR_URL=%s", bo.coordinatorAddr))

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("failed to start process: %w", err)
	}

	instance := &BackendInstance{
		Process: cmd.Process,
		Command: cmd,
		Info: core.BackendInfo{
			Address:   fmt.Sprintf("http://localhost:%d", port),
			Port:      port,
			StartedAt: time.Now(),
			Status:    "starting",
		},
	}

	return instance, nil
}

// waitForHealthy waits for backend to become healthy
func (bo *BackendOrchestrator) waitForHealthy(backend *BackendInstance) bool {
	client := &http.Client{Timeout: 2 * time.Second}
	attempts := 0

	for attempts < bo.options.HealthCheckMaxAttempts {
		resp, err := client.Get(fmt.Sprintf("%s/health", backend.Info.Address))
		if err == nil && resp.StatusCode == http.StatusOK {
			resp.Body.Close()
			bo.logger.Printf("Backend on port %d is healthy after %d attempts", backend.Info.Port, attempts+1)
			backend.Info.Status = "healthy"
			return true
		}
		if resp != nil {
			resp.Body.Close()
		}

		time.Sleep(time.Duration(bo.options.HealthCheckIntervalMs) * time.Millisecond)
		attempts++
	}

	bo.logger.Printf("Backend on port %d failed health checks after %d attempts", backend.Info.Port, attempts)
	return false
}

// shutdownBackend gracefully shuts down a backend
func (bo *BackendOrchestrator) shutdownBackend(backend *BackendInstance) {
	if backend.Process != nil {
		bo.logger.Printf("Shutting down backend on port %d (PID: %d)", backend.Info.Port, backend.Process.Pid)
		
		// Try graceful shutdown first with SIGTERM (Unix-like systems)
		if err := backend.Process.Signal(os.Interrupt); err != nil {
			bo.logger.Printf("Failed to send interrupt signal, killing process: %v", err)
			if err := backend.Process.Kill(); err != nil {
				bo.logger.Printf("Error killing backend process: %v", err)
			}
			return
		}
		
		// Wait up to 5 seconds for graceful shutdown
		done := make(chan error, 1)
		go func() {
			_, err := backend.Process.Wait()
			done <- err
		}()
		
		select {
		case <-time.After(5 * time.Second):
			bo.logger.Printf("Backend did not exit gracefully, forcing kill")
			if err := backend.Process.Kill(); err != nil {
				bo.logger.Printf("Error killing backend process: %v", err)
			}
		case <-done:
			bo.logger.Printf("Backend exited gracefully")
		}
	}
}

// updateRegistry updates the backend registry with current instances
func (bo *BackendOrchestrator) updateRegistry() {
	infos := make([]core.BackendInfo, len(bo.instances))
	for i, instance := range bo.instances {
		infos[i] = instance.Info
	}
	bo.registry.Update(infos)
}

// Shutdown stops all backend instances
func (bo *BackendOrchestrator) Shutdown() {
	bo.logger.Println("Shutting down all backend instances")
	for _, instance := range bo.instances {
		bo.shutdownBackend(instance)
	}
	bo.instances = nil
}
