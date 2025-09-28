// Clean Windows implementation: system hotkey + native GDI overlay
//go:build windows

package main

import (
	"log"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

// Global DLL procs
var (
	user32 = windows.NewLazySystemDLL("user32.dll")
	gdi32  = windows.NewLazySystemDLL("gdi32.dll")

	procRegisterHotKey       = user32.NewProc("RegisterHotKey")
	procUnregisterHotKey     = user32.NewProc("UnregisterHotKey")
	procGetMessageW          = user32.NewProc("GetMessageW")
	procPostThreadMessageW   = user32.NewProc("PostThreadMessageW")
	procGetAsyncKeyState     = user32.NewProc("GetAsyncKeyState")

	procRegisterClassW       = user32.NewProc("RegisterClassW")
	procCreateWindowExW      = user32.NewProc("CreateWindowExW")
	procDefWindowProcW       = user32.NewProc("DefWindowProcW")
	procTranslateMessage     = user32.NewProc("TranslateMessage")
	procDispatchMessageW     = user32.NewProc("DispatchMessageW")
	procShowWindow           = user32.NewProc("ShowWindow")
	procUpdateWindow         = user32.NewProc("UpdateWindow")
	procPostQuitMessage      = user32.NewProc("PostQuitMessage")
	procGetSystemMetrics     = user32.NewProc("GetSystemMetrics")
	procSetLayeredWindowAttr = user32.NewProc("SetLayeredWindowAttributes")
	procGetClientRect        = user32.NewProc("GetClientRect")
	procBeginPaint           = user32.NewProc("BeginPaint")
	procEndPaint             = user32.NewProc("EndPaint")
	procFillRect             = user32.NewProc("FillRect")
	procSetWindowPos         = user32.NewProc("SetWindowPos")
	procPostMessageW         = user32.NewProc("PostMessageW")
	procDrawTextW            = user32.NewProc("DrawTextW")
	procSetCursorPos         = user32.NewProc("SetCursorPos")
	procInvalidateRect       = user32.NewProc("InvalidateRect")

	procCreateSolidBrush     = gdi32.NewProc("CreateSolidBrush")
	procDeleteObject         = gdi32.NewProc("DeleteObject")
	procCreatePen            = gdi32.NewProc("CreatePen")
	procSelectObject         = gdi32.NewProc("SelectObject")
	procMoveToEx             = gdi32.NewProc("MoveToEx")
	procLineTo               = gdi32.NewProc("LineTo")
	procCreateFontW          = gdi32.NewProc("CreateFontW")
	procSetBkMode            = gdi32.NewProc("SetBkMode")
	procSetTextColor         = gdi32.NewProc("SetTextColor")
)

// Windowing types
type (
	RECT struct{ left, top, right, bottom int32 }
	PAINTSTRUCT struct {
		hdc         uintptr
		fErase      int32
		rcPaint     RECT
		fRestore    int32
		fIncUpdate  int32
		rgbReserved [32]byte
	}
	WNDCLASS struct {
		style         uint32
		lpfnWndProc   uintptr
		cbClsExtra    int32
		cbWndExtra    int32
		hInstance     windows.Handle
		hIcon         windows.Handle
		hCursor       windows.Handle
		hbrBackground windows.Handle
		lpszMenuName  *uint16
		lpszClassName *uint16
	}
	MSG struct {
		hwnd    uintptr
		message uint32
		wParam  uintptr
		lParam  uintptr
		time    uint32
		pt      struct{ x, y int32 }
	}
)

// Constants
const (
	WS_POPUP          = 0x80000000
	WS_EX_LAYERED     = 0x00080000
	WS_EX_TRANSPARENT = 0x00000020
	WS_EX_TOOLWINDOW  = 0x00000080
	WS_EX_TOPMOST     = 0x00000008
	WS_EX_NOACTIVATE  = 0x08000000
	LWA_COLORKEY      = 0x00000001
	SW_SHOW           = 5
	SM_CXSCREEN       = 0
	SM_CYSCREEN       = 1
	WM_DESTROY        = 0x0002
	WM_PAINT          = 0x000F
	WM_ERASEBKGND     = 0x0014
	WM_NCHITTEST      = 0x0084
	WM_HOTKEY         = 0x0312
	WM_QUIT           = 0x0012
	HTTRANSPARENT     = 0xFFFFFFFF
	PS_SOLID          = 0
	SWP_NOSIZE        = 0x0001
	SWP_NOMOVE        = 0x0002
	SWP_SHOWWINDOW    = 0x0040
	// Text formatting (DrawText)
	DT_CENTER         = 0x00000001
	DT_VCENTER        = 0x00000004
	DT_SINGLELINE     = 0x00000020
	DT_CALCRECT       = 0x00000400
	// Background mode
	TRANSPARENT       = 1
	// Keyboard polling uses GetAsyncKeyState (no hook needed)
	MIN_CELL_SIZE     = 16
)

// Overlay state
var overlay struct {
	mu     sync.Mutex
	hwnd   uintptr
	doneCh chan struct{}
}

// Reusable font for labels (created on first paint, destroyed on WM_DESTROY)
var overlayFont uintptr
var overlayFontHeight int

// Path of selected indices for nested grids (1-based per depth)
var overlayPath []int

// Key mapping: for startGridN up to 3, map 1..9 row-major
func keyToCellIndex(vk int) (idx int, ok bool) {
	if startGridN <= 0 { return 0, false }
	max := startGridN * startGridN
	// Top-row numbers '1'..'9' VK codes: 0x31..0x39
	if vk >= 0x31 && vk <= 0x39 {
		n := vk - 0x30 // '1' -> 1
		if n >= 1 && n <= max {
			return n, true
		}
	}
	// Numpad '1'..'9' VK codes: 0x61..0x69
	if vk >= 0x61 && vk <= 0x69 {
		n := vk - 0x60
		if n >= 1 && n <= max {
			return n, true
		}
	}
	return 0, false
}

// (removed) cellIndexToCenter: superseded by nestedCellCenter

// Keyboard polling loop: monitors 1..9 while overlay is visible
func startKeyPolling(stop <-chan struct{}) {
	// Track previous state to detect key down edges per key
	prev := make(map[int]bool)
	for i := 0; i < 10; i++ { prev[i] = false }
	for {
		select {
		case <-stop:
			return
		default:
		}
		// Check top row 1..9 and numpad 1..9
		var handleKey = func(vk int) bool {
			st, _, _ := procGetAsyncKeyState.Call(uintptr(vk))
			down := int16(st)>>15 != 0
			was := prev[vk]
			prev[vk] = down
			if down && !was {
				if idx, ok := keyToCellIndex(vk); ok {
					// Shift modifier?
					shift, _, _ := procGetAsyncKeyState.Call(0x10) // VK_SHIFT
					if int16(shift)>>15 != 0 {
						// Refine into nested grid if current cell size allows
						overlay.mu.Lock()
						hwnd := overlay.hwnd
						pathCopy := make([]int, len(overlayPath))
						copy(pathCopy, overlayPath)
						overlay.mu.Unlock()
						if hwnd == 0 {
							return true
						}
						var rc RECT
						procGetClientRect.Call(hwnd, uintptr(unsafe.Pointer(&rc)))
						// descend to deepest rect
						cur := rc
						for _, p := range pathCopy {
							cur = cellRectForWindow(cur, startGridN, p)
						}
						w := int(cur.right - cur.left)
						h := int(cur.bottom - cur.top)
						if w/startGridN < MIN_CELL_SIZE || h/startGridN < MIN_CELL_SIZE {
							// too small to refine; flash repaint
							procInvalidateRect.Call(hwnd, 0, 1)
							return true
						}
						overlay.mu.Lock()
						overlayPath = append(overlayPath, idx)
						overlay.mu.Unlock()
						procInvalidateRect.Call(hwnd, 0, 1)
						return true
					}
					if x, y, ok2 := nestedCellCenter(idx); ok2 {
						procSetCursorPos.Call(uintptr(x), uintptr(y))
						hideOverlay()
						return true
					}
				}
			}
			return false
		}
		consumed := false
		for vk := 0x31; vk <= 0x39; vk++ { // '1'..'9'
			if handleKey(vk) { consumed = true; break }
		}
		if !consumed {
			for vk := 0x61; vk <= 0x69; vk++ { // Numpad 1..9
				if handleKey(vk) { break }
			}
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// Stable, package-level window procedure
func overlayWindowProc(hwnd uintptr, msg uint32, wParam, lParam uintptr) uintptr {
	switch msg {
	case WM_NCHITTEST:
		return HTTRANSPARENT
	case WM_ERASEBKGND:
		return 1
	case WM_PAINT:
		var ps PAINTSTRUCT
		hdc, _, _ := procBeginPaint.Call(hwnd, uintptr(unsafe.Pointer(&ps)))
		if hdc != 0 {
			var rcClient RECT
			procGetClientRect.Call(hwnd, uintptr(unsafe.Pointer(&rcClient)))
			blackBrush, _, _ := procCreateSolidBrush.Call(0x000000)
			procFillRect.Call(hdc, uintptr(unsafe.Pointer(&rcClient)), blackBrush)
			procDeleteObject.Call(blackBrush)

			// Pen for grid lines
			magenta := uintptr(0x00FF00FF)
			pen, _, _ := procCreatePen.Call(PS_SOLID, uintptr(lineWidth), magenta)
			oldPen, _, _ := procSelectObject.Call(hdc, pen)

			// Helper to draw grid lines within a rect
			drawGrid := func(r RECT, n int) {
				if n < 1 { n = 1 }
				w := int(r.right - r.left)
				h := int(r.bottom - r.top)
				if w <= 0 || h <= 0 { return }
				cellW := w / n
				cellH := h / n
				for i := 1; i < n; i++ {
					x := int(r.left) + i*cellW
					procMoveToEx.Call(hdc, uintptr(x), uintptr(r.top), 0)
					procLineTo.Call(hdc, uintptr(x), uintptr(r.bottom))
				}
				for i := 1; i < n; i++ {
					y := int(r.top) + i*cellH
					procMoveToEx.Call(hdc, uintptr(r.left), uintptr(y), 0)
					procLineTo.Call(hdc, uintptr(r.right), uintptr(y))
				}
			}

			// Helper to get child cell rect given 1-based index
			cellRect := func(r RECT, n, idx int) RECT {
				if n < 1 { n = 1 }
				w := int(r.right - r.left)
				h := int(r.bottom - r.top)
				cellW := w / n
				cellH := h / n
				idx--
				row := idx / n
				col := idx % n
				left := int(r.left) + col*cellW
				top := int(r.top) + row*cellH
				right := int(r.left) + (col+1)*cellW
				bottom := int(r.top) + (row+1)*cellH
				if col == n-1 { right = int(r.right) }
				if row == n-1 { bottom = int(r.bottom) }
				return RECT{left: int32(left), top: int32(top), right: int32(right), bottom: int32(bottom)}
			}

			// Draw root grid, then nested grids along overlayPath
			drawGrid(rcClient, startGridN)
			overlay.mu.Lock()
			pathCopy := make([]int, len(overlayPath))
			copy(pathCopy, overlayPath)
			overlay.mu.Unlock()
			curRect := rcClient
			for _, idx := range pathCopy {
				curRect = cellRect(curRect, startGridN, idx)
				drawGrid(curRect, startGridN)
			}

			// Prepare font sized to fit within a cell of the deepest rect
			w := int(curRect.right - curRect.left)
			h := int(curRect.bottom - curRect.top)
			cellW := w / startGridN
			cellH := h / startGridN
			if cellW < 1 { cellW = 1 }
			if cellH < 1 { cellH = 1 }
			// Worst-case label width uses max digit count among 1..n^2 (string of '8's)
			maxLabelDigits := len(strconv.Itoa(startGridN*startGridN))
			if maxLabelDigits < 1 { maxLabelDigits = 1 }
			testStr := strings.Repeat("8", maxLabelDigits)
			testLP, _ := windows.UTF16PtrFromString(testStr)
			// Available area inside the cell (padding ~10%)
			pad := cellW
			if cellH < pad { pad = cellH }
			pad = pad / 10
			if pad < 2 { pad = 2 }
			availW := cellW - 2*pad
			availH := cellH - 2*pad
			if availW < 1 { availW = 1 }
			if availH < 1 { availH = 1 }
			// Find a font height that fits testStr within availW x availH
			// Always start from the maximum cell dimension to allow growth after deep splits.
			maxStart := cellW
			if cellH < maxStart { maxStart = cellH }
			desired := maxStart
			// Iterate down until fits
			fitHeight := 0
			face, _ := windows.UTF16PtrFromString("Segoe UI")
			for hgt := desired; hgt >= 8; hgt-- {
				// Negative height to specify pixel character height
				f, _, _ := procCreateFontW.Call(
					uintptr(int32(-hgt)), 0, 0, 0,
					400,
					0, 0, 0,
					0, 0, 0, 0, 0,
					uintptr(unsafe.Pointer(face)),
				)
				of, _, _ := procSelectObject.Call(hdc, f)
				// Measure text
				r := RECT{}
				procDrawTextW.Call(
					hdc,
					uintptr(unsafe.Pointer(testLP)),
					^uintptr(0),
					uintptr(unsafe.Pointer(&r)),
					DT_CALCRECT|DT_SINGLELINE,
				)
				// Restore and delete temp font
				procSelectObject.Call(hdc, of)
				width := int(r.right - r.left)
				heightPx := int(r.bottom - r.top)
				if width <= availW && heightPx <= availH {
					fitHeight = hgt
					procDeleteObject.Call(f)
					break
				}
				procDeleteObject.Call(f)
			}
			if fitHeight == 0 { fitHeight = 8 }
			// Recreate cached font if needed
			if overlayFont == 0 || overlayFontHeight != fitHeight {
				if overlayFont != 0 {
					procDeleteObject.Call(overlayFont)
				}
				f, _, _ := procCreateFontW.Call(
					uintptr(int32(-fitHeight)), 0, 0, 0,
					400,
					0, 0, 0,
					0, 0, 0, 0, 0,
					uintptr(unsafe.Pointer(face)),
				)
				overlayFont = f
				overlayFontHeight = fitHeight
			}
			var oldFont uintptr
			if overlayFont != 0 {
				of, _, _ := procSelectObject.Call(hdc, overlayFont)
				oldFont = of
			}
			procSetBkMode.Call(hdc, TRANSPARENT)
			procSetTextColor.Call(hdc, 0x00FFFFFF)

			// Draw labels in deepest grid
			idx := 1
			for row := 0; row < startGridN; row++ {
				for col := 0; col < startGridN; col++ {
					r := cellRect(curRect, startGridN, idx)
					label := strconv.Itoa(idx)
					lp, _ := windows.UTF16PtrFromString(label)
					procDrawTextW.Call(
						hdc,
						uintptr(unsafe.Pointer(lp)),
						^uintptr(0),
						uintptr(unsafe.Pointer(&r)),
						DT_CENTER|DT_VCENTER|DT_SINGLELINE,
					)
					idx++
				}
			}

			if oldFont != 0 { procSelectObject.Call(hdc, oldFont) }
			procSelectObject.Call(hdc, oldPen)
			procDeleteObject.Call(pen)
		}
		procEndPaint.Call(hwnd, uintptr(unsafe.Pointer(&ps)))
		return 0
	case WM_DESTROY:
			if overlayFont != 0 {
				procDeleteObject.Call(overlayFont)
				overlayFont = 0
			}
			overlay.mu.Lock()
			overlayPath = nil
			overlay.mu.Unlock()
		procPostQuitMessage.Call(0)
		return 0
	}
	ret, _, _ := procDefWindowProcW.Call(hwnd, uintptr(msg), wParam, lParam)
	return ret
}

var (
	overlayClassOnce    sync.Once
	overlayClassErr     error
	overlayClassName    = "MOUSELESS_OVERLAY_CLASS"
	overlayClassNamePtr *uint16
)

func ensureOverlayClass() error {
	overlayClassOnce.Do(func() {
		name, _ := windows.UTF16PtrFromString(overlayClassName)
		overlayClassNamePtr = name
		wc := WNDCLASS{
			style:         0,
			lpfnWndProc:   windows.NewCallback(overlayWindowProc),
			hbrBackground: 0,
			lpszClassName: name,
		}
		if r, _, callErr := procRegisterClassW.Call(uintptr(unsafe.Pointer(&wc))); r == 0 {
			if errno, ok := callErr.(windows.Errno); ok && errno == 1410 { // ERROR_CLASS_ALREADY_EXISTS
				// class already exists; ignore
			} else {
				overlayClassErr = callErr
			}
		}
	})
	return overlayClassErr
}

// -----------------------------
// System hotkey registration
// -----------------------------
func startHotkey(cb func()) (func(), error) {
	kernel32 := windows.NewLazySystemDLL("kernel32.dll")
	procGetCurrentThreadId := kernel32.NewProc("GetCurrentThreadId")

	const (
		MOD_ALT     = 0x0001
		MOD_CONTROL = 0x0002
		HOTKEY_ID   = 1
		VK_C        = 0x43
	)

	// Try system-wide hotkey first
	r, _, _ := procRegisterHotKey.Call(0, HOTKEY_ID, MOD_CONTROL|MOD_ALT, VK_C)
	if r == 0 { // fallback to polling
		log.Println("RegisterHotKey failed; falling back to polling with GetAsyncKeyState for Ctrl+Alt+C.")
		stop := make(chan struct{})
		done := make(chan struct{})
		go func() {
			runtime.LockOSThread()
			defer runtime.UnlockOSThread()
			defer close(done)
			prev := false
			for {
				select {
				case <-stop:
					return
				default:
				}
				ctrl, _, _ := procGetAsyncKeyState.Call(0x11) // VK_CONTROL
				alt, _, _ := procGetAsyncKeyState.Call(0x12)  // VK_MENU
				c, _, _ := procGetAsyncKeyState.Call(VK_C)
				down := (int16(ctrl)>>15 != 0) && (int16(alt)>>15 != 0) && (int16(c)>>15 != 0)
				if down && !prev {
					cb()
				}
				prev = down
				time.Sleep(15 * time.Millisecond)
			}
		}()
		return func() { close(stop); <-done }, nil
	}

	// Message-loop based hotkey handling
	done := make(chan struct{})
	tidCh := make(chan uintptr, 1)
	go func() {
		runtime.LockOSThread()
		defer runtime.UnlockOSThread()
		defer close(done)
		t, _, _ := procGetCurrentThreadId.Call()
		tidCh <- t
		var msg MSG
		for {
			ret, _, _ := procGetMessageW.Call(uintptr(unsafe.Pointer(&msg)), 0, 0, 0)
			if int32(ret) <= 0 { // WM_QUIT or error
				break
			}
			if msg.message == WM_HOTKEY && msg.wParam == HOTKEY_ID {
				cb()
				continue
			}
			procTranslateMessage.Call(uintptr(unsafe.Pointer(&msg)))
			procDispatchMessageW.Call(uintptr(unsafe.Pointer(&msg)))
		}
		// Unregister on exit (best-effort)
		procUnregisterHotKey.Call(0, HOTKEY_ID)
	}()

	stop := func() {
		tid := <-tidCh
		procPostThreadMessageW.Call(tid, WM_QUIT, 0, 0)
		<-done
		procUnregisterHotKey.Call(0, HOTKEY_ID)
	}
	return stop, nil
}

func showOverlay() error {
	overlay.mu.Lock()
	defer overlay.mu.Unlock()
	if overlay.hwnd != 0 {
		return nil
	}

	overlay.doneCh = make(chan struct{})
	overlayPath = nil
	go func() {
		runtime.LockOSThread()
		defer runtime.UnlockOSThread()
		defer close(overlay.doneCh)

		// Ensure class registered once per process
		if err := ensureOverlayClass(); err != nil {
			log.Printf("RegisterClassW failed: %v", err)
			return
		}

		cx, _, _ := procGetSystemMetrics.Call(SM_CXSCREEN)
		cy, _, _ := procGetSystemMetrics.Call(SM_CYSCREEN)

		exStyle := uintptr(WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW | WS_EX_TOPMOST | WS_EX_NOACTIVATE)
		style := uintptr(WS_POPUP)
		hwnd, _, err := procCreateWindowExW.Call(
			exStyle,
			uintptr(unsafe.Pointer(overlayClassNamePtr)),
			0,
			style,
			0, 0,
			cx, cy,
			0, 0, 0, 0,
		)
		if hwnd == 0 {
			log.Printf("CreateWindowExW failed: %v", err)
			return
		}

		overlay.mu.Lock()
		overlay.hwnd = hwnd
		overlay.mu.Unlock()

		if r, _, err := procSetLayeredWindowAttr.Call(hwnd, 0x000000, 0, LWA_COLORKEY); r == 0 {
			log.Printf("SetLayeredWindowAttributes failed: %v", err)
		}

		procSetWindowPos.Call(hwnd, ^uintptr(0), 0, 0, 0, 0, SWP_NOMOVE|SWP_NOSIZE|SWP_SHOWWINDOW)
		procShowWindow.Call(hwnd, SW_SHOW)
		procUpdateWindow.Call(hwnd)

	// Start key polling while overlay is visible
	pollStop := make(chan struct{})
	go startKeyPolling(pollStop)

		var msg MSG
		for {
			r, _, _ := procGetMessageW.Call(uintptr(unsafe.Pointer(&msg)), 0, 0, 0)
			if int32(r) <= 0 {
				break
			}
			procTranslateMessage.Call(uintptr(unsafe.Pointer(&msg)))
			procDispatchMessageW.Call(uintptr(unsafe.Pointer(&msg)))
		}

		overlay.mu.Lock()
		overlay.hwnd = 0
		overlay.mu.Unlock()
	// stop polling
	close(pollStop)
	}()

	time.Sleep(150 * time.Millisecond)
	return nil
}

func hideOverlay() error {
	overlay.mu.Lock()
	hwnd := overlay.hwnd
	done := overlay.doneCh
	overlay.mu.Unlock()
	if hwnd == 0 {
		return nil
	}
	const WM_CLOSE = 0x0010
	procPostMessageW.Call(hwnd, WM_CLOSE, 0, 0)
	if done != nil {
		select {
		case <-done:
		case <-time.After(2 * time.Second):
			log.Println("hideOverlay: timeout waiting for window to close")
		}
	}
	overlay.mu.Lock()
	overlayPath = nil
	overlay.mu.Unlock()
	return nil
}

// isOverlayVisible reports whether the overlay window is currently shown.
func isOverlayVisible() bool {
	overlay.mu.Lock()
	defer overlay.mu.Unlock()
	return overlay.hwnd != 0
}

// Helper: compute child rect within r for a 1-based index in an n x n grid.
func cellRectForWindow(r RECT, n, idx int) RECT {
	if n < 1 { n = 1 }
	w := int(r.right - r.left)
	h := int(r.bottom - r.top)
	if w <= 0 || h <= 0 { return r }
	cellW := w / n
	cellH := h / n
	i := idx - 1
	row := i / n
	col := i % n
	left := int(r.left) + col*cellW
	top := int(r.top) + row*cellH
	right := int(r.left) + (col+1)*cellW
	bottom := int(r.top) + (row+1)*cellH
	if col == n-1 { right = int(r.right) }
	if row == n-1 { bottom = int(r.bottom) }
	return RECT{left: int32(left), top: int32(top), right: int32(right), bottom: int32(bottom)}
}

// Helper: compute center of idx within deepest refined rect; returns screen coords relative to the overlay client area.
func nestedCellCenter(idx int) (int, int, bool) {
	overlay.mu.Lock()
	hwnd := overlay.hwnd
	pathCopy := make([]int, len(overlayPath))
	copy(pathCopy, overlayPath)
	overlay.mu.Unlock()
	if hwnd == 0 || startGridN <= 0 { return 0, 0, false }
	var rc RECT
	procGetClientRect.Call(hwnd, uintptr(unsafe.Pointer(&rc)))
	cur := rc
	for _, p := range pathCopy {
		cur = cellRectForWindow(cur, startGridN, p)
	}
	// now center within cur for idx
	w := int(cur.right - cur.left)
	h := int(cur.bottom - cur.top)
	if w <= 0 || h <= 0 { return 0, 0, false }
	cellW := w / startGridN
	cellH := h / startGridN
	i := idx - 1
	row := i / startGridN
	col := i % startGridN
	left := int(cur.left) + col*cellW
	top := int(cur.top) + row*cellH
	right := int(cur.left) + (col+1)*cellW
	bottom := int(cur.top) + (row+1)*cellH
	if col == startGridN-1 { right = int(cur.right) }
	if row == startGridN-1 { bottom = int(cur.bottom) }
	cx := left + (right-left)/2
	cy := top + (bottom-top)/2
	return cx, cy, true
}
