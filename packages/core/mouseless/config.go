package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
)

// AppConfigPartial represents a partial configuration with presence semantics via pointers.
// JSON example:
// {"grid":3,"keys":"qwe","confirm":"enter","overlayAlpha":220,"overlayBg":"#303030"}
type AppConfigPartial struct {
    Grid          *int    `json:"grid,omitempty"`
    Keys          *string `json:"keys,omitempty"`
    Confirm       *string `json:"confirm,omitempty"`        // "auto" | "enter"
    OverlayAlpha  *int    `json:"overlayAlpha,omitempty"`   // 0-255
    OverlayBg     *string `json:"overlayBg,omitempty"`      // hex color like "#303030"
}

// EffectiveConfig is the finalized, concrete configuration used by the app.
type EffectiveConfig struct {
    Grid          int
    Keys          string
    Confirm       string
    OverlayAlpha  int
    OverlayBg     string
}

func loadConfig(path string) (AppConfigPartial, error) {
    var cfg AppConfigPartial
    if path == "" {
        return cfg, errors.New("no config path provided")
    }
    b, err := os.ReadFile(path)
    if err != nil {
        return cfg, err
    }
    if err := json.Unmarshal(b, &cfg); err != nil {
        return cfg, err
    }
    return cfg, nil
}

// Merge overlays non-nil fields from other onto receiver and returns the result.
func (base AppConfigPartial) Merge(other AppConfigPartial) AppConfigPartial {
    out := base
    if other.Grid != nil { out.Grid = other.Grid }
    if other.Keys != nil { out.Keys = other.Keys }
    if other.Confirm != nil { out.Confirm = other.Confirm }
    if other.OverlayAlpha != nil { out.OverlayAlpha = other.OverlayAlpha }
    if other.OverlayBg != nil { out.OverlayBg = other.OverlayBg }
    return out
}

// Finalize applies defaults to missing fields and produces an EffectiveConfig.
func (p AppConfigPartial) Finalize(def EffectiveConfig) EffectiveConfig {
    out := def
    if p.Grid != nil { out.Grid = *p.Grid }
    if p.Keys != nil { out.Keys = *p.Keys }
    if p.Confirm != nil { out.Confirm = *p.Confirm }
    if p.OverlayAlpha != nil { out.OverlayAlpha = *p.OverlayAlpha }
    if p.OverlayBg != nil { out.OverlayBg = *p.OverlayBg }
    return out
}

// parseHexColor parses a string like "#RRGGBB" or "RRGGBB" into a COLORREF 0x00BBGGRR.
func parseHexColor(s string) (uint32, error) {
    ss := strings.TrimSpace(s)
    if ss == "" { return 0, fmt.Errorf("empty color") }
    if ss[0] == '#' { ss = ss[1:] }
    if len(ss) != 6 { return 0, fmt.Errorf("color must be 6 hex chars") }
    var r, g, b uint32
    if _, err := fmt.Sscanf(ss, "%02x%02x%02x", &r, &g, &b); err != nil {
        return 0, err
    }
    return (b << 16) | (g << 8) | r, nil
}
