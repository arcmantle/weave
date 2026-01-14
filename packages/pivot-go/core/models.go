package core

import "time"

// BackendInfo represents information about a backend server instance
type BackendInfo struct {
	Address   string    `json:"address"`
	Port      int       `json:"port"`
	StartedAt time.Time `json:"startedAt"`
	Status    string    `json:"status"`
}

// BackendOptions configures the backend server
type BackendOptions struct {
	// PluginDirectory is the directory to load plugins from
	PluginDirectory string
	
	// EnableAutoReload watches plugin directory and triggers reload on changes
	EnableAutoReload bool
	
	// WatchDebounceMs is the debounce delay for file change events in milliseconds
	WatchDebounceMs int
	
	// CoordinatorURL is the URL of the coordinator (set via environment variable)
	CoordinatorURL string
}

// CoordinatorOptions configures the coordinator
type CoordinatorOptions struct {
	// ServerBinaryPath is the path to the server binary to execute
	ServerBinaryPath string
	
	// InitialPort is the first port to assign to backend instances
	InitialPort int
	
	// HealthCheckMaxAttempts is the maximum number of health check attempts
	HealthCheckMaxAttempts int
	
	// HealthCheckIntervalMs is the delay between health checks in milliseconds
	HealthCheckIntervalMs int
	
	// TrafficDrainDelayMs is the time to wait before shutting down old backend
	TrafficDrainDelayMs int
	
	// ShutdownDrainTimeMs is the time to wait for graceful shutdown
	ShutdownDrainTimeMs int
}

// ProxyOptions configures the proxy
type ProxyOptions struct {
	// CoordinatorURL is the base URL of the coordinator
	CoordinatorURL string
}
