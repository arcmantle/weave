//go:build !windows

package mouseless

import (
	"log"
	pl "mouseless/main/internal/platform"
)

type stubPlatform struct{}

func (stubPlatform) StartHotkey(cb func()) (func(), error) {
    log.Println("Hotkey support not implemented on this platform yet. No-op.")
    return func() {}, nil
}

func (stubPlatform) ShowOverlay(cfg pl.OverlayConfig) error {
    log.Println("Overlay not implemented on this platform yet.")
    return nil
}

func (stubPlatform) HideOverlay() error { return nil }

func (stubPlatform) IsOverlayVisible() bool { return false }

// NewPlatform returns the stub platform for non-Windows builds.
func NewPlatform() pl.Platform { return stubPlatform{} }
