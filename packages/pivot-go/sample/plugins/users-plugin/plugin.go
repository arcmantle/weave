package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/arcmantle/weave/packages/pivot-go/core"
)

// UsersPlugin demonstrates a real-world plugin for user management
type UsersPlugin struct {
	users []User
}

type User struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"createdAt"`
}

// NewPlugin is the required constructor for plugins
func NewPlugin() core.Plugin {
	return &UsersPlugin{
		users: []User{
			{ID: 1, Name: "Alice Smith", Email: "alice@example.com", CreatedAt: time.Now()},
			{ID: 2, Name: "Bob Johnson", Email: "bob@example.com", CreatedAt: time.Now()},
			{ID: 3, Name: "Charlie Brown", Email: "charlie@example.com", CreatedAt: time.Now()},
		},
	}
}

// Name returns the plugin name
func (p *UsersPlugin) Name() string {
	return "UsersPlugin"
}

// Initialize is called when the plugin is loaded
func (p *UsersPlugin) Initialize() error {
	// Could connect to database, load config, etc.
	return nil
}

// Register registers HTTP handlers with the server
func (p *UsersPlugin) Register(mux *http.ServeMux) {
	// GET /api/users - List all users
	mux.HandleFunc("/api/users", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"users": p.users,
			"count": len(p.users),
		})
	})

	// GET /api/users/{id} - Get user by ID
	mux.HandleFunc("/api/users/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Simple ID extraction from path
		var id int
		if _, err := fmt.Sscanf(r.URL.Path, "/api/users/%d", &id); err != nil {
			http.Error(w, "Invalid user ID", http.StatusBadRequest)
			return
		}

		for _, user := range p.users {
			if user.ID == id {
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(user)
				return
			}
		}

		http.Error(w, "User not found", http.StatusNotFound)
	})

	// GET /api/stats - Plugin statistics
	mux.HandleFunc("/api/stats", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"plugin":      p.Name(),
			"totalUsers":  len(p.users),
			"version":     "1.0.0",
			"lastUpdated": time.Now(),
		})
	})
}
