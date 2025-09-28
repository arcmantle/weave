// main.go
package main

import (
	"log"
)

// Grid settings
const (
	gridSize      = 50
	lineWidth     = 1 // pixels
	toggleKeyChar = 'c' // Hotkey is Ctrl + Alt + C
)

// showOverlay/hideOverlay are implemented per-platform.
// On Windows they create/destroy a transparent, click-through window and draw the grid with GDI.

func main() {
	log.Println("Press Ctrl+Alt+C to toggle the grid overlay. Press Ctrl+C to exit.")
	isOverlayRunning := false

	stop, err := startHotkey(func() {
		if !isOverlayRunning {
			log.Println("Hotkey pressed! Starting overlay...")
			if err := showOverlay(); err != nil {
				log.Printf("Failed to show overlay: %v", err)
				return
			}
			isOverlayRunning = true
		} else {
			log.Println("Hotkey pressed! Closing overlay...")
			if err := hideOverlay(); err != nil {
				log.Printf("Failed to hide overlay: %v", err)
				return
			}
			isOverlayRunning = false
		}
	})
	if err != nil {
		log.Fatalf("Failed to set up hotkey: %v", err)
	}
	defer stop()

	select {} // block forever; use Ctrl+C to quit the program
}
