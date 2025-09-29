// main.go
package main

import (
	"flag"
	"log"
	"os"
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

func main() {
	// Flags
	configPath := flag.String("config", "", "Path to JSON config file")
	gridFlag := flag.Int("grid", 3, "Starting grid size (n for an n×n grid)")
	keysFlag := flag.String("keys", "nums", "Key mapping scheme: 'nums' (n×n), 'qwe' (3×3), or 'qwer' (4×3). 'qwerty' is an alias of 'qwe'.")
	confirmFlag := flag.String("confirm", "auto", "Confirmation mode: 'auto' (click immediately) or 'enter' (press Enter to click)")
	overlayAlphaFlag := flag.Int("overlay-alpha", 220, "Overlay global alpha 0-255 (higher = more opaque)")
	overlayBgFlag := flag.String("overlay-bg", "#303030", "Overlay background color in hex (e.g. #303030)")
	flag.Parse()
	// Track which flags were explicitly set to honor precedence (flags > config > defaults)
	visited := map[string]bool{}
	flag.CommandLine.Visit(func(f *flag.Flag) { visited[f.Name] = true })

	// Defaults (effective)
	defaults := EffectiveConfig{ Grid: 3, Keys: "nums", Confirm: "auto", OverlayAlpha: 220, OverlayBg: "#303030" }

	// Determine config file path: explicit --config or autodetect
	var cfgPath string
	if configPath != nil && *configPath != "" {
		cfgPath = *configPath
	} else {
		if _, err := os.Stat("mouseless.json"); err == nil {
			cfgPath = "mouseless.json"
		}
	}
	// Load from config file if found
	var filePartial AppConfigPartial
	if cfgPath != "" {
		if c, err := loadConfig(cfgPath); err == nil {
			filePartial = c
			log.Printf("Loaded config: %s", cfgPath)
		} else {
			log.Printf("Could not load config '%s': %v", cfgPath, err)
		}
	}
	var flagPartial AppConfigPartial
	if visited["grid"] && gridFlag != nil && *gridFlag > 0 {
		v := *gridFlag
		flagPartial.Grid = &v
	}
	if visited["keys"] && keysFlag != nil {
		v := *keysFlag
		if v == "qwerty" { v = "qwe" } // alias
		switch v {
		case "nums", "qwe", "qwer":
			flagPartial.Keys = &v
		default:
			log.Printf("Unknown --keys scheme '%s', defaulting to 'nums'", *keysFlag)
			d := "nums"; flagPartial.Keys = &d
		}
	}
	if visited["confirm"] && confirmFlag != nil {
		switch *confirmFlag {
		case "auto":
			v := "auto"; flagPartial.Confirm = &v
		case "enter":
			v := "enter"; flagPartial.Confirm = &v
		default:
			log.Printf("Unknown --confirm mode '%s', defaulting to 'auto'", *confirmFlag)
			v := "auto"; flagPartial.Confirm = &v
		}
	}
	if visited["overlay-alpha"] && overlayAlphaFlag != nil { v := *overlayAlphaFlag; flagPartial.OverlayAlpha = &v }
	if visited["overlay-bg"] && overlayBgFlag != nil && *overlayBgFlag != "" { v := *overlayBgFlag; flagPartial.OverlayBg = &v }

	// Merge: defaults <- file <- flags
	effective := filePartial.Merge(flagPartial).Finalize(defaults)
	// Apply merged config to globals used in logs/behavior
	startGridN = effective.Grid
	keyScheme = effective.Keys
	confirmWithEnter = (effective.Confirm == "enter")

	// Normalize overlay alpha
	overlayAlpha := effective.OverlayAlpha
	if overlayAlpha < 0 { overlayAlpha = 0 }
	if overlayAlpha > 255 { overlayAlpha = 255 }
	// Parse overlay background color (#RRGGBB -> COLORREF 0x00BBGGRR)
	overlayBg := uint32(0x00303030)
	if c, err := parseHexColor(effective.OverlayBg); err == nil {
		overlayBg = c
	} else {
		log.Printf("Invalid overlay color '%s', using default #303030", effective.OverlayBg)
	}

	// Friendly notes: letter modes use fixed layouts regardless of --grid
	if keyScheme == "qwe" {
		log.Printf("Note: --keys qwe uses a fixed 3×3 layout (ignores --grid).")
	}
	if keyScheme == "qwer" {
		log.Printf("Note: --keys qwer uses a fixed 4×3 layout (ignores --grid).")
	}

	mode := "auto"
	if confirmWithEnter { mode = "enter" }
	log.Printf("Using settings → grid: %dx%d, keys: %s, confirm: %s, overlayAlpha: %d, overlayBg: %s", startGridN, startGridN, keyScheme, mode, overlayAlpha, effective.OverlayBg)
	log.Printf("Starting grid size: %dx%d, keys: %s, confirm: %s", startGridN, startGridN, keyScheme, mode)
	log.Println("Press Ctrl+Alt+C to toggle the grid overlay. Press Ctrl+C to exit.")

	stop, err := platform.StartHotkey(func() {
		if platform.IsOverlayVisible() {
			log.Println("Hotkey pressed! Closing overlay...")
			if err := platform.HideOverlay(); err != nil {
				log.Printf("Failed to hide overlay: %v", err)
			}
			return
		}
		log.Println("Hotkey pressed! Starting overlay...")
		cfg := OverlayConfig{ GridN: startGridN, KeyScheme: keyScheme, ConfirmWithEnter: confirmWithEnter, OverlayAlpha: overlayAlpha, OverlayBgColor: overlayBg }
		log.Printf("Launching overlay with: alpha=%d, bgColor=0x%06X", cfg.OverlayAlpha, cfg.OverlayBgColor)
		if err := platform.ShowOverlay(cfg); err != nil {
			log.Printf("Failed to show overlay: %v", err)
		}
	})
	if err != nil {
		log.Fatalf("Failed to set up hotkey: %v", err)
	}
	defer stop()

	select {} // block forever; use Ctrl+C to quit the program
}
