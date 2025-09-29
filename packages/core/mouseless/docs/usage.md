# Mouseless usage

## Build

```powershell
# From this folder
go build -o mouseless.exe ./cmd/mouseless
```

## First run

```powershell
# Write a default config in the current folder
./mouseless.exe --init-config
```

## Launch

```powershell
# Start with defaults
./mouseless.exe

# Customize via flags
./mouseless.exe --grid 3 --keys nums --confirm auto --overlay-alpha 220 --overlay-bg "#303030"
```

## During use

- Ctrl+Alt+C toggles the overlay.
- While visible:
  - Press 1..n^2 (or letter labels) to select cells. Hold Shift to refine nested selection instead of clicking.
  - Press Enter to click (when `--confirm enter`).
  - Use arrow keys to move overlay across monitors.
- Ctrl+C exits the app.

## Config resolution order

1. `--config` path
2. `./mouseless.json`
3. `./mouseless.example.json`
4. `./configs/mouseless.json`
5. `./configs/mouseless.example.json`

See `configs/mouseless.example.json` for all fields.
