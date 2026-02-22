package main

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
)

var colors = []string{
	"\033[36m", // cyan
	"\033[33m", // yellow
	"\033[35m", // magenta
	"\033[32m", // green
	"\033[34m", // blue
	"\033[91m", // bright red
	"\033[96m", // bright cyan
	"\033[93m", // bright yellow
	"\033[95m", // bright magenta
	"\033[92m", // bright green
}

const reset = "\033[0m"

func main() {
	root, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to get working directory: %v\n", err)
		os.Exit(1)
	}

	entries, err := os.ReadDir(root)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to read directory: %v\n", err)
		os.Exit(1)
	}

	var dirs []string
	maxLen := 0
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		dir := filepath.Join(root, entry.Name())
		ws := filepath.Join(dir, "pnpm-workspace.yaml")
		if _, err := os.Stat(ws); err == nil {
			dirs = append(dirs, dir)
			if len(entry.Name()) > maxLen {
				maxLen = len(entry.Name())
			}
		}
	}

	if len(dirs) == 0 {
		fmt.Println("No workspaces found.")
		return
	}

	failed := 0

	for i, dir := range dirs {
		name := filepath.Base(dir)
		color := colors[i%len(colors)]
		tag := fmt.Sprintf("%s[%-*s]%s", color, maxLen, name, reset)

		fmt.Printf("%s Installing...\n", tag)

		cmd := exec.Command("pnpm", "i")
		cmd.Dir = dir

		stdout, _ := cmd.StdoutPipe()
		stderr, _ := cmd.StderrPipe()

		if err := cmd.Start(); err != nil {
			fmt.Fprintf(os.Stderr, "%s \033[31mFailed to start: %v%s\n", tag, err, reset)
			failed++
			continue
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

		if err := cmd.Wait(); err != nil {
			fmt.Fprintf(os.Stderr, "%s \033[31mFailed%s\n", tag, reset)
			failed++
		} else {
			fmt.Printf("%s \033[32mDone%s\n", tag, reset)
		}

		fmt.Println()
	}

	if failed > 0 {
		fmt.Fprintf(os.Stderr, "\033[31m%d workspace(s) failed.%s\n", failed, reset)
		os.Exit(1)
	}

	fmt.Printf("\033[32mAll workspaces installed.%s\n", reset)
}
