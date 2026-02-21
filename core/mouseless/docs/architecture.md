# Project structure plan and migration steps

This document outlines the target folder layout and a phased migration plan to get there safely while keeping builds green.

## Target layout

- cmd/
  - mouseless/
    - main.go — CLI entrypoint; parse flags, wire config + platform, run
- internal/
  - config/
    - types.go — AppConfigPartial, EffectiveConfig, helpers (ParseHexColor), Load, WriteDefault
  - platform/
    - platform.go — Platform interface + OverlayConfig
    - windows/ — (optional future) Windows implementation (native GDI)
    - stub/ — (optional future) No-op implementation for non-Windows
- configs/
  - mouseless.example.json — example config
- docs/
  - architecture.md — this plan
- README.md — updated to reflect native Windows overlay and features

Notes:

- internal/ packages are importable only from within this module and keep our surface area small.
- Platform code stays behind a Platform interface with build-tagged implementations per-OS.

## Phased migration

- [x] Phase 1 — Create docs and decide layout (this file)
- [x] Phase 2 — Extract common config into internal/config and update code to use it
- [x] Phase 3 — Introduce internal/platform (interface + factory) and hook Windows implementation via NewPlatform()
- [x] Phase 4 — Move entrypoint to cmd/mouseless/main.go (root is now a library `mouseless`)
- [ ] Phase 5 — Cleanups: update README, remove dead deps (e.g., Ebiten if unused), add example config to configs/

## Acceptance criteria per phase

- Phase 2: `go build` succeeds; app behavior unchanged. Flags and config files still work.
- Phase 3: `go build` on Windows and non-Windows; Platform type resides in internal/platform; main depends only on interface. (Done)
- Phase 4: Binary builds from cmd/mouseless; root is library-only and exports Run(). (Done)
- Phase 5: Documentation current; repo tidy.

## Notes and edge cases

- Avoid import cycles by keeping config independent from platform; main performs the mapping from EffectiveConfig → OverlayConfig.
- Don’t rely on globals across packages; Windows impl should take its state from OverlayConfig.
- Keep flag parsing centralized to avoid duplicate flag.Parse calls.
