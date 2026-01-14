package orchestration

import (
	"sync"

	"github.com/arcmantle/weave/packages/pivot-go/core"
)

// BackendRegistry manages the list of active backends and notifies subscribers
type BackendRegistry struct {
	backends    []core.BackendInfo
	subscribers []chan []core.BackendInfo
	mu          sync.RWMutex
}

// NewBackendRegistry creates a new backend registry
func NewBackendRegistry() *BackendRegistry {
	return &BackendRegistry{
		backends:    make([]core.BackendInfo, 0),
		subscribers: make([]chan []core.BackendInfo, 0),
	}
}

// GetAll returns all registered backends
func (br *BackendRegistry) GetAll() []core.BackendInfo {
	br.mu.RLock()
	defer br.mu.RUnlock()
	
	result := make([]core.BackendInfo, len(br.backends))
	copy(result, br.backends)
	return result
}

// Update updates the backend list and notifies subscribers
func (br *BackendRegistry) Update(backends []core.BackendInfo) {
	br.mu.Lock()
	br.backends = make([]core.BackendInfo, len(backends))
	copy(br.backends, backends)
	subscribers := make([]chan []core.BackendInfo, len(br.subscribers))
	copy(subscribers, br.subscribers)
	br.mu.Unlock()

	// Notify all subscribers
	for _, ch := range subscribers {
		select {
		case ch <- backends:
		default:
			// Skip if channel is full
		}
	}
}

// Subscribe creates a new subscription channel for backend changes
func (br *BackendRegistry) Subscribe() chan []core.BackendInfo {
	br.mu.Lock()
	defer br.mu.Unlock()
	
	ch := make(chan []core.BackendInfo, 10)
	br.subscribers = append(br.subscribers, ch)
	return ch
}

// Unsubscribe removes a subscription channel
func (br *BackendRegistry) Unsubscribe(ch chan []core.BackendInfo) {
	br.mu.Lock()
	defer br.mu.Unlock()
	
	for i, sub := range br.subscribers {
		if sub == ch {
			br.subscribers = append(br.subscribers[:i], br.subscribers[i+1:]...)
			close(ch)
			break
		}
	}
}
