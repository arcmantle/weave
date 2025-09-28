# Mouseless Roadmap

This document tracks planned features, status, and design notes for the native Windows overlay grid tool.

## High-level goals

- Show an overlay grid that helps you target screen regions quickly using the keyboard.
- Support nested (progressively refined) grids by splitting a selected cell into another n×n grid.
- Display labels in each cell that represent the keyboard combination to select it.
- Move the mouse cursor to the center of a selected cell when confirmed.

## Current baseline (implemented)

- [x] Native Windows overlay window (click-through, topmost, color-key transparency)
- [x] Global hotkey to toggle overlay (Ctrl+Alt+C), with polling fallback
- [x] Grid lines rendering using GDI
- [x] Clean create/destroy on each toggle; repeated toggles are stable

## Feature roadmap

### 1) Configurable starting grid (n×n)

- Status: Done
- Summary: Allow starting the overlay with an arbitrary grid size (e.g., 2×2, 3×3, 4×4).
- Acceptance criteria:
  - Can configure default grid size (via flag/config, e.g., `--grid=3`).
  - The entire primary monitor is subdivided into `n×n` cells.
  - Lines render crisp under different DPI scales.
- Notes: Add basic DPI-awareness for crisp rendering; consider per-monitor bounds.

### 2) Per-cell text labels

- Status: Done
- Summary: Render a short label in each cell (e.g., a key or sequence like 1..9 / QWER / HJKL).
- Acceptance criteria:
  - Text is visible and centered in each cell.
  - Text scales reasonably with DPI.
  - Background remains transparent; no flicker.
- Implementation sketch:
  - Use GDI text APIs: SetBkMode(TRANSPARENT), SetTextColor, DrawTextW.
  - Create/select a font once per window; dispose on destroy.

### 3) Keyboard combinations for cell selection

- Status: Done (via polling)
- Summary: Press keys corresponding to a cell to select it and move the mouse to the cell center.
- Acceptance criteria:
  - While overlay is active, typing the mapped key selects the cell.
  - Without modifier, selection confirms and moves the cursor.
  - With a modifier held, the selected cell splits into a subgrid (see feature 4).
- Design note:
  - The overlay window is non-activating and click-through; it won’t receive key events.
  - Options:
    - Register a set of system hotkeys for each cell (limited and clunky).
    - Or install a low-level keyboard hook (WH_KEYBOARD_LL) to capture keys while overlay is visible.
  - Implemented initially with GetAsyncKeyState polling while overlay is visible for simplicity and stability.
  - Low-level hook (WH_KEYBOARD_LL) remains an option if we need more nuance later.

### 4) Nested subgrids by modifier + selection

- Status: Done
- Summary: Holding a modifier while picking a cell splits that cell into its own n×n subgrid. Repeat as needed.
- Requirements:
  - Subgrid is conceptually a child node; the original grid remains the “active” key map so we can reuse shortcuts.
  - User can repeat the process until the cell size becomes too small or until they confirm without the modifier to move the mouse.
- Acceptance criteria:
  - Pressing e.g., Shift + `cell key` overlays a subgrid inside that cell with new labels.
  - Pressing just `cell key` moves the mouse to the current cell center and exits overlay.
  - There’s a configurable minimum cell size (e.g., 16 px) below which we stop splitting.
- Design model:
  - Grid tree: a root grid covering the screen; nodes may have children.
  - Active visual stack: rendering shows the root plus any nested children (for context), with emphasis on the most recent subgrid.

### 5) Mouse movement to cell center

- Status: Done
- Summary: On confirm (no modifier), move the mouse pointer to the selected cell’s center.
- Acceptance criteria:
  - Cursor moves smoothly and accurately to the computed center.
  - Works at various DPI scales and across monitors (when multi-monitor is supported).
- Implementation: Use SetCursorPos; ensure coordinates are in screen space.

### 6) Multi-monitor and DPI-awareness

- Status: Planned
- Summary: Support multiple displays and DPI scaling.
- Acceptance criteria:
  - Grid covers the target monitor; can optionally span all monitors.
  - Coordinates and rendering scale correctly under per-monitor DPI.
- Implementation notes:
  - Make the process per-monitor DPI aware (SetProcessDpiAwarenessContext / manifest).
  - Use EnumDisplayMonitors to size per-monitor overlays when enabled.

### 7) Configuration and UX polish

- Status: Planned
- Items:
  - Configurable default grid size, subgrid size, key map scheme (numbers, QWER, HJKL, etc.), modifier for split.
  - Animations or subtle highlight for selected cells.
  - Theme (colors, line width, font size).
  - Optional: audible feedback.

## Proposed key mapping schemes

- 2×2: Q W / A S or 1 2 / 3 4.
- 3×3: 1–9 (numeric keypad style) or QWE / ASD / ZXC.
- 4×4: QWER / ASDF / ZXCV / 1234 (choose one and keep consistent).
- The chosen scheme should be mnemonic and comfortable for one hand.

## Data model (draft)

- GridNode
  - rect: screen-space bounds
  - n: int (subdivision size, e.g., 2, 3, 4)
  - children: []*GridNode (nil unless split)
  - label: optional string (for leaf or display purposes)
- Active path: indices from root to current leaf for rendering emphasis.
- Rendering derives cell rects on the fly from node rect + n.

## Interaction flow

1) User toggles overlay (Ctrl+Alt+C).
2) Overlay shows an n×n grid with labels.
3) User presses a key combination:
   - With modifier (e.g., Shift): split that cell into an n×n subgrid (new labels), keep overlay.
   - Without modifier: move mouse to the cell center and exit overlay.
4) Repeat 3 with deeper subgrids until minimum size or completion.

## Milestones

- M1 (MVP visuals):
  - [x] Configurable starting n×n grid
  - [x] Draw labels in cells
- M2 (Selection mechanics):
  - [x] Keyboard input capture to select cells (polling-based)
  - [x] Move mouse to center on confirm
- M3 (Nested grids):
  - [x] Modifier-based split into subgrids (hold Shift + key to refine)
  - [x] Minimum cell size enforcement (currently 16 px)
- M4 (Platform polish):
  - [ ] Multi-monitor support
  - [ ] DPI awareness
  - [ ] Config (flags or file)

## Risks and considerations

- Keyboard handling: Low-level hooks require careful threading and cleanup.
- Input conflicts: Reserve simple hotkeys; avoid clashing with common shortcuts.
- GDI text quality: May consider DirectWrite/Direct2D later for sharper text/lines.
- Performance: Keep WM_PAINT minimal; cache pens/brushes/fonts.

## Next steps

- Multi-monitor support and DPI awareness for crisp lines and accurate coordinates.
- Make minimum cell size and split modifier configurable.
- Optional: replace polling with a low-level keyboard hook if needed.
- Add alternate key mapping schemes (QWER/ASDF, etc.) and simple theming.
