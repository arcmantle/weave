// main.go
package mouseless

import (
	"log"
	pl "mouseless/main/internal/platform"
)

// Grid settings
const (
	lineWidth     = 1   // pixels
	toggleKeyChar = 'c' // Hotkey is Ctrl + Alt + C
)

// Start grid configuration (n x n)
var startGridN = 3

// Key mapping scheme: "nums" (1..n^2), "qwe" (QWE/ASD/ZXC for 3x3), "qwer" (QWER/ASDF/ZXCV for 4x3)
var keyScheme = "nums"

// When true, selection only moves the cursor; pressing Enter performs the click.
var confirmWithEnter = false

// showOverlay/hideOverlay are implemented per-platform.
// On Windows they create/destroy a transparent, click-through window and draw the grid with GDI.

func Run() {
	// Centralized config handling
	effective, overlayCfg, cfgPath, didInit, err := PrepareConfigs()
	if err != nil {
		log.Fatalf("Config error: %v", err)
	}
	if didInit {
		// Default config written; exit
		return
	}
	// Apply merged config to globals used in logs/behavior
	startGridN = effective.Grid
	keyScheme = effective.Keys
	confirmWithEnter = (effective.Confirm == "enter")

	overlayAlpha := overlayCfg.OverlayAlpha

	// Friendly notes: letter modes use fixed layouts regardless of --grid
	if keyScheme == "qwe" {
		log.Printf("Note: --keys qwe uses a fixed 3×3 layout (ignores --grid).")
	}
	if keyScheme == "qwer" {
		log.Printf("Note: --keys qwer uses a fixed 4×3 layout (ignores --grid).")
	}

	mode := "auto"
	if confirmWithEnter { mode = "enter" }
	if cfgPath != "" { log.Printf("Loaded config: %s", cfgPath) }
	log.Printf("Using settings → grid: %dx%d, keys: %s, confirm: %s, overlayAlpha: %d, overlayBg: %s", startGridN, startGridN, keyScheme, mode, overlayAlpha, effective.OverlayBg)
	log.Printf("Starting grid size: %dx%d, keys: %s, confirm: %s", startGridN, startGridN, keyScheme, mode)
	log.Println("Press Ctrl+Alt+C to toggle the grid overlay. Press Ctrl+C to exit.")

	plat := pl.New()
	stop, err := plat.StartHotkey(func() {
		if plat.IsOverlayVisible() {
			log.Println("Hotkey pressed! Closing overlay...")
			if err := plat.HideOverlay(); err != nil {
				log.Printf("Failed to hide overlay: %v", err)
			}
			return
		}
		log.Println("Hotkey pressed! Starting overlay...")
		log.Printf("Launching overlay with: alpha=%d, bgColor=0x%06X", overlayCfg.OverlayAlpha, overlayCfg.OverlayBgColor)
		if err := plat.ShowOverlay(overlayCfg); err != nil {
			log.Printf("Failed to show overlay: %v", err)
		}
	})
	if err != nil {
		log.Fatalf("Failed to set up hotkey: %v", err)
	}
	defer stop()

	select {} // block forever; use Ctrl+C to quit the program
}
