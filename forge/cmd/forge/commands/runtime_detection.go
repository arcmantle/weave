package commands

import "os/exec"

func hasGo() bool {
	_, err := exec.LookPath("go")
	return err == nil
}

func hasNode() bool {
	_, err := exec.LookPath("node")
	return err == nil
}

func hasDotnet() bool {
	_, err := exec.LookPath("dotnet")
	return err == nil
}

func hasPnpm() bool {
	_, err := exec.LookPath("pnpm")
	return err == nil
}
