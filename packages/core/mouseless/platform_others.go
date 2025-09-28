// platform_others.go
//go:build !windows

package main

import "log"

// startHotkey is not implemented on non-Windows platforms in this example.
func startHotkey(cb func()) (func(), error) {
	log.Println("Hotkey support via RegisterHotKey is only implemented on Windows in this example.")
	// Provide a no-op stopper so main can proceed for dev/testing.
	return func() {}, nil
}

func showOverlay() error {
	log.Println("Overlay drawing is only implemented on Windows in this example.")
	return nil
}

func hideOverlay() error {
	return nil
}
