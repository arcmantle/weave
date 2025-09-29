//go:build windows

package main

// windowsPlatform adapts the existing Windows functions to the Platform interface.
type windowsPlatform struct{}

func (windowsPlatform) StartHotkey(cb func()) (func(), error) { return startHotkey(cb) }

func (windowsPlatform) ShowOverlay(cfg OverlayConfig) error {
    // Bridge config into existing globals used by Windows implementation
    if cfg.GridN > 0 { startGridN = cfg.GridN }
    if cfg.KeyScheme != "" { keyScheme = cfg.KeyScheme }
    confirmWithEnter = cfg.ConfirmWithEnter
    // Apply even if zero: zero is a valid color (black) and alpha (fully transparent)
    if cfg.OverlayAlpha < 0 { overlayAlpha = 0 } else if cfg.OverlayAlpha > 255 { overlayAlpha = 255 } else { overlayAlpha = cfg.OverlayAlpha }
    overlayBgColor = cfg.OverlayBgColor
    return showOverlay()
}

func (windowsPlatform) HideOverlay() error { return hideOverlay() }

func (windowsPlatform) IsOverlayVisible() bool { return isOverlayVisible() }

func init() {
    platform = windowsPlatform{}
}
