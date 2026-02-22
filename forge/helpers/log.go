package helpers

import "fmt"

// ANSI color constants for use with Exec and logging.
const (
	ColorReset     = "\033[0m"
	ColorRed       = "\033[31m"
	ColorGreen     = "\033[32m"
	ColorYellow    = "\033[33m"
	ColorBlue      = "\033[34m"
	ColorMagenta   = "\033[35m"
	ColorCyan      = "\033[36m"
	ColorGray      = "\033[90m"
	ColorBrightRed = "\033[91m"
)

// Colors is a list of colors for cycling through in multi-stream output.
var Colors = []string{
	ColorCyan,
	ColorYellow,
	ColorMagenta,
	ColorGreen,
	ColorBlue,
	ColorBrightRed,
	"\033[96m", // bright cyan
	"\033[93m", // bright yellow
	"\033[95m", // bright magenta
	"\033[92m", // bright green
}

// Info prints an info message.
func Info(format string, args ...any) {
	fmt.Printf("\033[36minfo:\033[0m "+format+"\n", args...)
}

// Warn prints a warning message.
func Warn(format string, args ...any) {
	fmt.Printf("\033[33mwarn:\033[0m "+format+"\n", args...)
}

// Error prints an error message.
func Error(format string, args ...any) {
	fmt.Printf("\033[31merror:\033[0m "+format+"\n", args...)
}

// Success prints a success message.
func Success(format string, args ...any) {
	fmt.Printf("\033[32m✓\033[0m "+format+"\n", args...)
}
