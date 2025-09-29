package main

// Platform defines the OS-specific operations the app needs.
// Each OS must provide an implementation in a build-tagged file
// that assigns the package-level variable 'platform'.
type Platform interface {
    // StartHotkey registers the global toggle hotkey and invokes cb when pressed.
    // Returns a stop function to unregister/stop.
    StartHotkey(cb func()) (stop func(), err error)
    // ShowOverlay displays the overlay using the provided config.
    ShowOverlay(cfg OverlayConfig) error
    // HideOverlay hides/destroys the overlay.
    HideOverlay() error
    // IsOverlayVisible reports whether the overlay is currently shown.
    IsOverlayVisible() bool
}

// OverlayConfig contains runtime options for the overlay.
type OverlayConfig struct {
    GridN            int    // n for n×n when using numeric mode
    KeyScheme        string // "nums" | "qwe" | "qwer"
    ConfirmWithEnter bool   // if true, require Enter to click
    OverlayAlpha     int    // 0-255 global alpha for the overlay (255=opaque)
    OverlayBgColor   uint32 // COLORREF (0x00BBGGRR)
}

// platform is the active OS-specific implementation.
var platform Platform
