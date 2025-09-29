//go:build !windows

package platform

import st "mouseless/main/internal/platform/stub"

type stubAdapter struct{}

func (stubAdapter) StartHotkey(cb func()) (func(), error) { return st.StartHotkey(cb) }
func (stubAdapter) ShowOverlay(cfg OverlayConfig) error {
	return st.ShowOverlay(st.Config{
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
func (stubAdapter) HideOverlay() error { return st.HideOverlay() }
func (stubAdapter) IsOverlayVisible() bool { return st.IsOverlayVisible() }

// New returns a no-op platform on non-Windows systems.
func New() Platform { return stubAdapter{} }
