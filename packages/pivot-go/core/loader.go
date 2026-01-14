package core

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"plugin"
)

// PluginLoader handles loading and managing plugins
type PluginLoader struct {
	plugins []Plugin
	logger  *log.Logger
}

// NewPluginLoader creates a new plugin loader
func NewPluginLoader(logger *log.Logger) *PluginLoader {
	if logger == nil {
		logger = log.New(os.Stdout, "[PluginLoader] ", log.LstdFlags)
	}
	return &PluginLoader{
		plugins: make([]Plugin, 0),
		logger:  logger,
	}
}

// LoadFromDirectory loads plugins from a directory
func (pl *PluginLoader) LoadFromDirectory(directory string) error {
	if _, err := os.Stat(directory); os.IsNotExist(err) {
		pl.logger.Printf("Plugin directory not found: %s", directory)
		return nil
	}

	pattern := filepath.Join(directory, "*.so")
	matches, err := filepath.Glob(pattern)
	if err != nil {
		return fmt.Errorf("failed to glob plugin directory: %w", err)
	}

	for _, pluginPath := range matches {
		if err := pl.loadPlugin(pluginPath); err != nil {
			pl.logger.Printf("Failed to load plugin %s: %v", pluginPath, err)
			continue
		}
	}

	pl.logger.Printf("Loaded %d plugin(s)", len(pl.plugins))
	return nil
}

// loadPlugin loads a single plugin file
func (pl *PluginLoader) loadPlugin(path string) error {
	p, err := plugin.Open(path)
	if err != nil {
		return fmt.Errorf("failed to open plugin: %w", err)
	}

	// Look for NewPlugin symbol
	symbol, err := p.Lookup("NewPlugin")
	if err != nil {
		return fmt.Errorf("plugin missing NewPlugin function: %w", err)
	}

	// Cast to plugin constructor function
	newPlugin, ok := symbol.(func() Plugin)
	if !ok {
		return fmt.Errorf("NewPlugin has wrong signature")
	}

	// Create plugin instance
	pluginInstance := newPlugin()
	
	pl.logger.Printf("Loading plugin: %s from %s", pluginInstance.Name(), filepath.Base(path))
	
	// Initialize plugin
	if err := pluginInstance.Initialize(); err != nil {
		return fmt.Errorf("failed to initialize plugin %s: %w", pluginInstance.Name(), err)
	}

	pl.plugins = append(pl.plugins, pluginInstance)
	return nil
}

// GetPlugins returns all loaded plugins
func (pl *PluginLoader) GetPlugins() []Plugin {
	return pl.plugins
}

// RegisterAll registers all loaded plugins with the HTTP mux
func (pl *PluginLoader) RegisterAll(mux *http.ServeMux) {
	for _, p := range pl.plugins {
		pl.logger.Printf("Registering plugin: %s", p.Name())
		p.Register(mux)
	}
}
