# Forge: Nested .forge Script Discovery

## Completed

- [x] Evaluate feasibility and design priority semantics
- [x] Add `DiscoverScripts` and `discoverScriptsInDir` to `forge/internal/manifest/discover.go`
- [x] Update `getManifest()` in `forge/cmd/forge/main.go` to merge auto-discovered scripts
- [x] Update `forge/README.md` with auto-discovered scripts documentation
- [x] Build and verify compilation

## Design

**Feature**: Auto-discover scripts from `.forge/scripts/` directories without requiring `forge.yaml` entries.

**Priority** (highest to lowest):
1. Closest `forge.yaml` commands
2. Root `forge.yaml` commands
3. Closest `.forge/scripts/` auto-discovered commands
4. Root `.forge/scripts/` auto-discovered commands

**Convention**: `.forge/scripts/<name>/<name>.{go,ts,cs}` — first matching extension wins.
