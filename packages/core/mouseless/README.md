# Mouseless overlay (Windows)

A small Go tool that toggles a click-through screen grid with Ctrl+Alt+C to help aim the mouse accurately. Uses native Windows APIs (GDI, layered windows).

## Features

- System-wide hotkey: Ctrl+Alt+C to toggle overlay on/off
- Click-through layered window (mouse/keyboard go to apps underneath)
- Transparent background via color key; only the grid is visible
- Works even if the global hotkey is already taken (falls back to polling)

## Build

Requires Go 1.24+ on Windows.

```powershell
# From this folder
go build -o mouseless.exe ./cmd/mouseless
```

## Run

```powershell
# First time: write a default config to ./mouseless.json
./mouseless.exe --init-config

# Launch with defaults
./mouseless.exe
```

- Press Ctrl+Alt+C to show the grid overlay.
- Press Ctrl+Alt+C again to hide it.
- Press Ctrl+C in the terminal to exit the app.

## Notes & Troubleshooting

- If you see "RegisterHotKey failed; falling back to polling...", the app couldn't register the hotkey (another program is using it). It switches to a lightweight polling mode and still reacts to Ctrl+Alt+C.
- If the overlay shows but you can't click through, try running the terminal as Administrator (some shells or UAC contexts can block click-through on other elevated windows).
- While visible: use arrow keys to move overlay across monitors; hold Shift while selecting to refine deeper.

## Config

Order of config resolution (first wins): `--config` path, `./mouseless.json`, `./mouseless.example.json`, `./configs/mouseless.json`, `./configs/mouseless.example.json`.
See `configs/mouseless.example.json` for all fields (grid, keys, confirm, overlayAlpha/overlayBg, styling).
