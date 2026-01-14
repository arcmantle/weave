package core

import "net/http"

// Plugin is the interface that all plugins must implement
type Plugin interface {
	// Name returns the name of the plugin
	Name() string
	
	// Initialize is called when the plugin is loaded, before the server starts
	// Use this to register dependencies, configure services, etc.
	Initialize() error
	
	// Register is called to register HTTP handlers with the server
	Register(mux *http.ServeMux)
}
