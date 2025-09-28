// main.go
package main

import (
	"flag"
	"log"
)

// Grid settings
const (
	lineWidth     = 1   // pixels
	toggleKeyChar = 'c' // Hotkey is Ctrl + Alt + C
)

// Start grid configuration (n x n)
var startGridN = 3

// showOverlay/hideOverlay are implemented per-platform.
// On Windows they create/destroy a transparent, click-through window and draw the grid with GDI.

func main() {
	// Flags
	gridFlag := flag.Int("grid", 3, "Starting grid size (n for an n×n grid)")
	flag.Parse()
	if gridFlag != nil && *gridFlag > 0 {
		startGridN = *gridFlag
	}

	log.Printf("Starting grid size: %dx%d", startGridN, startGridN)
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
