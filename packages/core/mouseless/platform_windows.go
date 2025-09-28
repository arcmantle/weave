// Clean Windows implementation: system hotkey + native GDI overlay
//go:build windows

package main

import (
	"log"
	"runtime"
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

	procCreateSolidBrush     = gdi32.NewProc("CreateSolidBrush")
	procDeleteObject         = gdi32.NewProc("DeleteObject")
	procCreatePen            = gdi32.NewProc("CreatePen")
	procSelectObject         = gdi32.NewProc("SelectObject")
	procMoveToEx             = gdi32.NewProc("MoveToEx")
	procLineTo               = gdi32.NewProc("LineTo")
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
)

// Overlay state
var overlay struct {
	mu     sync.Mutex
	hwnd   uintptr
	doneCh chan struct{}
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
			var rc RECT
			procGetClientRect.Call(hwnd, uintptr(unsafe.Pointer(&rc)))
			blackBrush, _, _ := procCreateSolidBrush.Call(0x000000)
			procFillRect.Call(hdc, uintptr(unsafe.Pointer(&rc)), blackBrush)
			procDeleteObject.Call(blackBrush)

			magenta := uintptr(0x00FF00FF)
			pen, _, _ := procCreatePen.Call(PS_SOLID, uintptr(lineWidth), magenta)
			oldPen, _, _ := procSelectObject.Call(hdc, pen)

			w := int(rc.right - rc.left)
			h := int(rc.bottom - rc.top)
			for x := 0; x <= w; x += gridSize {
				procMoveToEx.Call(hdc, uintptr(x), 0, 0)
				procLineTo.Call(hdc, uintptr(x), uintptr(h))
			}
			for y := 0; y <= h; y += gridSize {
				procMoveToEx.Call(hdc, 0, uintptr(y), 0)
				procLineTo.Call(hdc, uintptr(w), uintptr(y))
			}

			procSelectObject.Call(hdc, oldPen)
			procDeleteObject.Call(pen)
		}
		procEndPaint.Call(hwnd, uintptr(unsafe.Pointer(&ps)))
		return 0
	case WM_DESTROY:
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
	return nil
}
