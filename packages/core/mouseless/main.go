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

// Key mapping scheme: "nums" (1..n^2), "qwe" (QWE/ASD/ZXC for 3x3), "qwer" (QWER/ASDF/ZXCV/TYUI for 4x4)
var keyScheme = "nums"

// When true, selection only moves the cursor; pressing Enter performs the click.
var confirmWithEnter = false

// showOverlay/hideOverlay are implemented per-platform.
// On Windows they create/destroy a transparent, click-through window and draw the grid with GDI.

func main() {
	// Flags
	gridFlag := flag.Int("grid", 3, "Starting grid size (n for an n×n grid)")
	keysFlag := flag.String("keys", "nums", "Key mapping scheme: 'nums', 'qwe' (3x3), or 'qwer' (4x4). 'qwerty' is an alias of 'qwe'.")
	confirmFlag := flag.String("confirm", "auto", "Confirmation mode: 'auto' (click immediately) or 'enter' (press Enter to click)")
	flag.Parse()
	if gridFlag != nil && *gridFlag > 0 {
		startGridN = *gridFlag
	}
	if keysFlag != nil {
		v := *keysFlag
		if v == "qwerty" { v = "qwe" } // alias
		switch v {
		case "nums", "qwe", "qwer":
			keyScheme = v
		default:
			log.Printf("Unknown --keys scheme '%s', defaulting to 'nums'", *keysFlag)
			keyScheme = "nums"
		}
	}
	if confirmFlag != nil {
		switch *confirmFlag {
		case "auto":
			confirmWithEnter = false
		case "enter":
			confirmWithEnter = true
		default:
			log.Printf("Unknown --confirm mode '%s', defaulting to 'auto'", *confirmFlag)
			confirmWithEnter = false
		}
	}

	// Friendly warnings for mismatched schemes and grid sizes
	if keyScheme == "qwe" && startGridN != 3 {
		log.Printf("Note: --keys qwe is designed for --grid 3; with grid %d, numeric labels/keys will be used.", startGridN)
	}
	if keyScheme == "qwer" && startGridN != 4 {
		log.Printf("Note: --keys qwer is designed for --grid 4; with grid %d, numeric labels/keys will be used.", startGridN)
	}

	mode := "auto"
	if confirmWithEnter { mode = "enter" }
	log.Printf("Starting grid size: %dx%d, keys: %s, confirm: %s", startGridN, startGridN, keyScheme, mode)
	log.Println("Press Ctrl+Alt+C to toggle the grid overlay. Press Ctrl+C to exit.")

	stop, err := startHotkey(func() {
		if isOverlayVisible() {
			log.Println("Hotkey pressed! Closing overlay...")
			if err := hideOverlay(); err != nil {
				log.Printf("Failed to hide overlay: %v", err)
			}
			return
		}
		log.Println("Hotkey pressed! Starting overlay...")
		if err := showOverlay(); err != nil {
			log.Printf("Failed to show overlay: %v", err)
		}
	})
	if err != nil {
		log.Fatalf("Failed to set up hotkey: %v", err)
	}
	defer stop()

	select {} // block forever; use Ctrl+C to quit the program
}
