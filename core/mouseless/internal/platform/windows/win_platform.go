//go:build windows

package windows

// Config is a local copy of overlay runtime options for the Windows implementation.
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

// StartHotkey registers the platform hotkey handler.
func StartHotkey(cb func()) (func(), error) { return startHotkey(cb) }

// ShowOverlay applies the configuration and shows the overlay.
func ShowOverlay(cfg Config) error {
    if cfg.GridN > 0 { startGridN = cfg.GridN }
    if cfg.KeyScheme != "" { keyScheme = cfg.KeyScheme }
    confirmWithEnter = cfg.ConfirmWithEnter
    if cfg.OverlayAlpha < 0 { overlayAlpha = 0 } else if cfg.OverlayAlpha > 255 { overlayAlpha = 255 } else { overlayAlpha = cfg.OverlayAlpha }
    overlayBgColor = cfg.OverlayBgColor
    if cfg.GridLineWidth > 0 { gridLineWidth = cfg.GridLineWidth } else { gridLineWidth = 1 }
    if cfg.CrosshairThickness > 0 { crosshairThickness = cfg.CrosshairThickness } else { crosshairThickness = 2 }
    if cfg.GridColor != 0 { gridColor = cfg.GridColor }
    if cfg.LabelTextColor != 0 { labelTextColor = cfg.LabelTextColor }
    if cfg.LabelBgColor != 0 { labelBgColor = cfg.LabelBgColor }
    if cfg.CrosshairColor != 0 { crosshairColor = cfg.CrosshairColor }
    return showOverlay()
}

// HideOverlay hides the overlay window.
func HideOverlay() error { return hideOverlay() }

// IsOverlayVisible reports whether the overlay is currently visible.
func IsOverlayVisible() bool { return isOverlayVisible() }
