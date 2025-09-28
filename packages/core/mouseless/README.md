# Mouseless overlay (Windows)

A tiny Go app that toggles a click-through screen overlay grid with Ctrl+Alt+C. Built with Ebiten and Windows APIs.

## Features

- System-wide hotkey: Ctrl+Alt+C to toggle overlay on/off
- Click-through layered window (mouse/keyboard go to apps underneath)
- Transparent background via color key; only the grid is visible
- Works even if the global hotkey is already taken (falls back to polling)

## Build

Requires Go 1.24+ on Windows.

```powershell
# From this folder
go build -o mouseless.exe .
```

## Run

```powershell
# Run the compiled binary
./mouseless.exe
```

- Press Ctrl+Alt+C to show the grid overlay.
- Press Ctrl+Alt+C again to hide it.
- Press Ctrl+C in the terminal to exit the app.

## Notes & Troubleshooting

- If you see "RegisterHotKey failed; falling back to polling...", the app couldn't register the hotkey (another program is using it). It switches to a lightweight polling mode and still reacts to Ctrl+Alt+C.
- If the overlay shows but you can't click through, try running the terminal as Administrator (some shells or UAC contexts can block click-through on other elevated windows).
- The overlay covers your primary monitor. Multi-monitor support can be added if needed.
- Grid tuning: update constants in `main.go`
  - `gridSize` (default 50)
  - `lineWidth` (default 1.0)
  - `lineColor` (magenta with alpha)

## How it works

- The Ebiten window fills the screen with black, and draws magenta lines.
- Windows extended styles are set to `WS_EX_LAYERED | WS_EX_TRANSPARENT` so the window is transparent and click-through.
- `SetLayeredWindowAttributes(..., colorKey=black)` makes all black pixels fully transparent, so only the grid remains visible.
- The app uses a system-wide hotkey (or polling fallback) and starts/stops the Ebiten loop on demand.
