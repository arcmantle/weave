//go:build windows

package platform

import win "mouseless/main/internal/platform/windows"

type winAdapter struct{}

func (winAdapter) StartHotkey(cb func()) (func(), error) { return win.StartHotkey(cb) }
func (winAdapter) ShowOverlay(cfg OverlayConfig) error {
	return win.ShowOverlay(win.Config{
		GridN: cfg.GridN,
		KeyScheme: cfg.KeyScheme,
		ConfirmWithEnter: cfg.ConfirmWithEnter,
		OverlayAlpha: cfg.OverlayAlpha,
		OverlayBgColor: cfg.OverlayBgColor,
		GridColor: cfg.GridColor,
		GridLineWidth: cfg.GridLineWidth,
		LabelTextColor: cfg.LabelTextColor,
		LabelBgColor: cfg.LabelBgColor,
		CrosshairColor: cfg.CrosshairColor,
		CrosshairThickness: cfg.CrosshairThickness,
	})
}
func (winAdapter) HideOverlay() error { return win.HideOverlay() }
func (winAdapter) IsOverlayVisible() bool { return win.IsOverlayVisible() }

// New returns the platform implementation for Windows.
func New() Platform { return winAdapter{} }
