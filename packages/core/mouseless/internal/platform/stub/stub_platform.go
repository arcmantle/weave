//go:build !windows

package stub

import "log"

// Config mirrors overlay options for non-Windows stubs.
type Config struct {
    GridN             int
    KeyScheme         string
    ConfirmWithEnter  bool
    OverlayAlpha      int
    OverlayBgColor    uint32
    GridColor         uint32
    GridLineWidth     int
    LabelTextColor    uint32
    LabelBgColor      uint32
    CrosshairColor    uint32
    CrosshairThickness int
}

func StartHotkey(cb func()) (func(), error) {
    log.Println("Hotkey support not implemented on this platform yet. No-op.")
    return func() {}, nil
}

func ShowOverlay(cfg Config) error {
    log.Println("Overlay not implemented on this platform yet.")
    _ = cfg
    return nil
}

func HideOverlay() error { return nil }
func IsOverlayVisible() bool { return false }
