# Forge Script Runner — VS Code Extension

Browse, navigate, and run [forge](../README.md) commands from the VS Code sidebar.

## Features

- **Sidebar tree view** — see all forge commands grouped by `:` prefix, with icons distinguishing Go, TypeScript, C#, and composite commands
- **Click to navigate** — clicking a script-backed command opens the script file
- **Run from tree** — right-click any command → Run in Terminal (or use the inline play button)
- **CodeLens on forge.yaml** — "Run | Open Script" links above each command definition
- **Auto-refresh** — watches `forge.yaml` and `.forge/scripts/` for changes
- **Manifest discovery** — walks up the directory tree just like the CLI, merging commands with closest-wins semantics

## Install

```bash
cd forge/forge-vscode
pnpm install
pnpm run compile
pnpm run package
```

Then install the `.vsix` file:

```bash
code --install-extension forge-runner-0.0.1.vsix
```

## Development

```bash
pnpm run watch    # compile on save
# Then press F5 in VS Code to launch the Extension Development Host
```

## How It Works

The extension mirrors the forge CLI's manifest discovery:

1. Walk up from each workspace folder root looking for `forge.yaml` files
2. Auto-discover scripts from `.forge/scripts/` directories
3. Merge with closest-wins semantics (same priority rules as the CLI)
4. Build a tree view grouped by `:` prefixes in command names

No forge binary is required for discovery — the extension parses YAML directly. Running commands does invoke `forge` via the integrated terminal.
