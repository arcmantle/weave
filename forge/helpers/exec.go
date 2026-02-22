package helpers

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"sync"
)

// RunOpts configures how a command is executed.
type RunOpts struct {
	// Dir sets the working directory. If empty, uses the current directory.
	Dir string
	// Tag is a prefix label for output lines (e.g. workspace name).
	Tag string
	// Color is an ANSI color code for the tag (e.g. "\033[36m").
	Color string
	// Env adds environment variables on top of the current env.
	Env map[string]string
	// Silent suppresses all output if true.
	Silent bool
}

// Exec runs a command with streaming prefixed output.
// Returns an error if the command fails.
func Exec(name string, args []string, opts RunOpts) error {
	cmd := exec.Command(name, args...)

	if opts.Dir != "" {
		cmd.Dir = opts.Dir
	}

	if len(opts.Env) > 0 {
		cmd.Env = os.Environ()
		for k, v := range opts.Env {
			cmd.Env = append(cmd.Env, k+"="+v)
		}
	}

	if opts.Silent {
		cmd.Stdout = nil
		cmd.Stderr = nil
		return cmd.Run()
	}

	// If no tag, just pass through stdout/stderr directly.
	if opts.Tag == "" {
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.Stdin = os.Stdin
		return cmd.Run()
	}

	// Prefixed output mode.
	tag := formatTag(opts.Tag, opts.Color)

	stdout, _ := cmd.StdoutPipe()
	stderr, _ := cmd.StderrPipe()

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("starting %s: %w", name, err)
	}

	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			fmt.Printf("%s %s\n", tag, scanner.Text())
		}
	}()

	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			fmt.Fprintf(os.Stderr, "%s %s\n", tag, scanner.Text())
		}
	}()

	wg.Wait()

	return cmd.Wait()
}

// ExecSimple runs a command and returns its combined output as a string.
func ExecSimple(name string, args []string, dir string) (string, error) {
	cmd := exec.Command(name, args...)
	if dir != "" {
		cmd.Dir = dir
	}

	out, err := cmd.CombinedOutput()
	return string(out), err
}

func formatTag(tag string, color string) string {
	if color == "" {
		return fmt.Sprintf("[%s]", tag)
	}

	return fmt.Sprintf("%s[%s]\033[0m", color, tag)
}
