package main

import (
	"encoding/json"
	"net/http"

	"github.com/arcmantle/weave/packages/pivot-go/core"
)

// HelloPlugin is an example plugin
type HelloPlugin struct{}

// NewPlugin is the required constructor function for plugins
func NewPlugin() core.Plugin {
	return &HelloPlugin{}
}

// Name returns the plugin name
func (p *HelloPlugin) Name() string {
	return "HelloPlugin"
}

// Initialize is called when the plugin is loaded
func (p *HelloPlugin) Initialize() error {
	// Perform any initialization here
	return nil
}

// Register registers HTTP handlers with the server
func (p *HelloPlugin) Register(mux *http.ServeMux) {
	mux.HandleFunc("/hello", func(w http.ResponseWriter, r *http.Request) {
		response := map[string]string{
			"message": "Hello from HelloPlugin!",
			"plugin":  "HelloPlugin",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	})

	mux.HandleFunc("/users", func(w http.ResponseWriter, r *http.Request) {
		users := []string{"Alice", "Bob", "Charlie"}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(users)
	})
}
