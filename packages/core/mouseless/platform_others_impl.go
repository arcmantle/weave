//go:build !windows

package main

import "log"

type stubPlatform struct{}

func (stubPlatform) StartHotkey(cb func()) (func(), error) {
    log.Println("Hotkey support not implemented on this platform yet. No-op.")
    return func() {}, nil
}

func (stubPlatform) ShowOverlay(cfg OverlayConfig) error {
    log.Println("Overlay not implemented on this platform yet.")
    return nil
}

func (stubPlatform) HideOverlay() error { return nil }

func (stubPlatform) IsOverlayVisible() bool { return false }

func init() { platform = stubPlatform{} }
