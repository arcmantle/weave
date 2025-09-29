package mouseless

import (
	"flag"
	"log"
	cfg "mouseless/main/internal/config"
	pl "mouseless/main/internal/platform"
	"os"
)

// Flags for configuration and behavior
var (
    flagConfigPath     = flag.String("config", "", "Path to JSON config file")
    flagGrid           = flag.Int("grid", 3, "Starting grid size (n for an n×n grid)")
    flagKeys           = flag.String("keys", "nums", "Key mapping scheme: 'nums' (n×n), 'qwe' (3×3), or 'qwer' (4×3). 'qwerty' is an alias of 'qwe'.")
    flagConfirm        = flag.String("confirm", "auto", "Confirmation mode: 'auto' (click immediately) or 'enter' (press Enter to click)")
    flagOverlayAlpha   = flag.Int("overlay-alpha", 220, "Overlay global alpha 0-255 (higher = more opaque)")
    flagOverlayBg      = flag.String("overlay-bg", "#303030", "Overlay background color in hex (e.g. #303030)")
    // Utility: write default config and exit
    flagInitConfig     = flag.Bool("init-config", false, "Write default config to ./mouseless.json and exit")
)

// PrepareConfigs parses flags, optionally writes defaults, loads and merges config, and returns the effective and overlay configs.
// If didInit is true, the caller should exit without starting the app.
func PrepareConfigs() (effective cfg.EffectiveConfig, overlay pl.OverlayConfig, loadedPath string, didInit bool, err error) {
    // Parse flags once here
    flag.Parse()
    // Track visited flags to honor precedence: defaults < file < visited flags
    visited := map[string]bool{}
    flag.CommandLine.Visit(func(f *flag.Flag) { visited[f.Name] = true })

    // If asked to init config, write defaults and return
    if flagInitConfig != nil && *flagInitConfig {
        def := cfg.EffectiveConfig{
            Grid: 3, Keys: "nums", Confirm: "auto",
            OverlayAlpha: 220, OverlayBg: "#303030",
            GridColor: "#FF00FF", GridLineWidth: lineWidth,
            LabelTextColor: "#FFFFFF", LabelBgColor: "#404040",
            CrosshairColor: "#FFFFFF", CrosshairThickness: 2,
        }
        path, werr := cfg.WriteDefault("mouseless.json", def)
    if werr != nil { return cfg.EffectiveConfig{}, pl.OverlayConfig{}, "", true, werr }
        log.Printf("Wrote default config to %s", path)
    return cfg.EffectiveConfig{}, pl.OverlayConfig{}, path, true, nil
    }

    // Defaults used when finalizing
    defaults := cfg.EffectiveConfig{
        Grid: 3, Keys: "nums", Confirm: "auto",
        OverlayAlpha: 220, OverlayBg: "#303030",
        GridColor: "#FF00FF", GridLineWidth: lineWidth,
        LabelTextColor: "#FFFFFF", LabelBgColor: "#404040",
        CrosshairColor: "#FFFFFF", CrosshairThickness: 2,
    }

    // Determine config file to load: explicit or autodetect
    var cfgPath string
    if flagConfigPath != nil && *flagConfigPath != "" {
        cfgPath = *flagConfigPath
    } else {
        // Search common locations in order
        candidates := []string{
            "mouseless.json",
            "mouseless.example.json",
            "configs/mouseless.json",
            "configs/mouseless.example.json",
        }
        for _, p := range candidates {
            if _, e := os.Stat(p); e == nil { cfgPath = p; break }
        }
    }

    var filePartial cfg.AppConfigPartial
    if cfgPath != "" {
        if c, lerr := cfg.Load(cfgPath); lerr == nil {
            filePartial = c
            loadedPath = cfgPath
            log.Printf("Loaded config: %s", cfgPath)
        } else {
            log.Printf("Could not load config '%s': %v", cfgPath, lerr)
        }
    }

    var flagPartial cfg.AppConfigPartial
    if visited["grid"] && flagGrid != nil && *flagGrid > 0 {
        v := *flagGrid; flagPartial.Grid = &v
    }
    if visited["keys"] && flagKeys != nil {
        v := *flagKeys
        if v == "qwerty" { v = "qwe" }
        switch v {
        case "nums", "qwe", "qwer":
            flagPartial.Keys = &v
        default:
            log.Printf("Unknown --keys scheme '%s', defaulting to 'nums'", *flagKeys)
            d := "nums"; flagPartial.Keys = &d
        }
    }
    if visited["confirm"] && flagConfirm != nil {
        v := *flagConfirm
        if v != "enter" { v = "auto" }
        flagPartial.Confirm = &v
    }
    if visited["overlay-alpha"] && flagOverlayAlpha != nil { v := *flagOverlayAlpha; flagPartial.OverlayAlpha = &v }
    if visited["overlay-bg"] && flagOverlayBg != nil && *flagOverlayBg != "" { v := *flagOverlayBg; flagPartial.OverlayBg = &v }

    eff := filePartial.Merge(flagPartial).Finalize(defaults)

    // Convert to OverlayConfig with parsed colors and clamped alpha
    ov := pl.OverlayConfig{
        GridN: eff.Grid,
        KeyScheme: eff.Keys,
        ConfirmWithEnter: eff.Confirm == "enter",
        OverlayAlpha: clamp(eff.OverlayAlpha, 0, 255),
    }
    if c, e := cfg.ParseHexColor(eff.OverlayBg); e == nil { ov.OverlayBgColor = c } else { log.Printf("Invalid overlay color '%s'", eff.OverlayBg) }
    if c, e := cfg.ParseHexColor(eff.GridColor); e == nil { ov.GridColor = c }
    ov.GridLineWidth = eff.GridLineWidth
    if c, e := cfg.ParseHexColor(eff.LabelTextColor); e == nil { ov.LabelTextColor = c }
    if c, e := cfg.ParseHexColor(eff.LabelBgColor); e == nil { ov.LabelBgColor = c }
    if c, e := cfg.ParseHexColor(eff.CrosshairColor); e == nil { ov.CrosshairColor = c }
    ov.CrosshairThickness = eff.CrosshairThickness

    return eff, ov, loadedPath, false, nil
}

// WriteDefaultConfig writes defaults to the given file if it doesn't exist.
// Deprecated: kept for compatibility during migration; prefer cfg.WriteDefault from internal/config.
func WriteDefaultConfig(path string) (string, error) {
    def := cfg.EffectiveConfig{
        Grid: 3, Keys: "nums", Confirm: "auto",
        OverlayAlpha: 220, OverlayBg: "#303030",
        GridColor: "#FF00FF", GridLineWidth: lineWidth,
        LabelTextColor: "#FFFFFF", LabelBgColor: "#404040",
        CrosshairColor: "#FFFFFF", CrosshairThickness: 2,
    }
    return cfg.WriteDefault(path, def)
}

func clamp(v, lo, hi int) int {
    if v < lo { return lo }
    if v > hi { return hi }
    return v
}
