//go:build windows

package mouseless

import (
	pl "mouseless/main/internal/platform"
)

// windowsPlatform adapts the existing Windows functions to the Platform interface.
type windowsPlatform struct{}

func (windowsPlatform) StartHotkey(cb func()) (func(), error) { return startHotkey(cb) }

func (windowsPlatform) ShowOverlay(cfg pl.OverlayConfig) error {
    // Bridge config into existing globals used by Windows implementation
    if cfg.GridN > 0 { startGridN = cfg.GridN }
    if cfg.KeyScheme != "" { keyScheme = cfg.KeyScheme }
    confirmWithEnter = cfg.ConfirmWithEnter
    // Apply even if zero: zero is a valid color (black) and alpha (fully transparent)
    if cfg.OverlayAlpha < 0 { overlayAlpha = 0 } else if cfg.OverlayAlpha > 255 { overlayAlpha = 255 } else { overlayAlpha = cfg.OverlayAlpha }
    overlayBgColor = cfg.OverlayBgColor
    // Styling
    if cfg.GridLineWidth > 0 { gridLineWidth = cfg.GridLineWidth } else { gridLineWidth = 1 }
    if cfg.CrosshairThickness > 0 { crosshairThickness = cfg.CrosshairThickness } else { crosshairThickness = 2 }
    if cfg.GridColor != 0 { gridColor = cfg.GridColor }
    if cfg.LabelTextColor != 0 { labelTextColor = cfg.LabelTextColor }
    if cfg.LabelBgColor != 0 { labelBgColor = cfg.LabelBgColor }
    if cfg.CrosshairColor != 0 { crosshairColor = cfg.CrosshairColor }
    return showOverlay()
}

func (windowsPlatform) HideOverlay() error { return hideOverlay() }

func (windowsPlatform) IsOverlayVisible() bool { return isOverlayVisible() }

// NewPlatform returns the Windows platform implementation.
func NewPlatform() pl.Platform { return windowsPlatform{} }
