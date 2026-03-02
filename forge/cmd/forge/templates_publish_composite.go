package main

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/arcmantle/forge/internal/manifest"
)

func generateCompositePublishScript(commandName string, command manifest.Command, lang string) (string, string, error) {
	selectedLang := strings.TrimSpace(strings.ToLower(lang))
	if selectedLang == "" {
		selectedLang = "go"
	}

	switch selectedLang {
	case "go":
		return renderCompositeGoScript(commandName, command), ".go", nil
	default:
		return "", "", fmt.Errorf("composite publish currently supports --lang go only")
	}
}

func renderCompositeGoScript(commandName string, command manifest.Command) string {
	description := strings.TrimSpace(command.Description)
	if description == "" {
		description = fmt.Sprintf("Composite command %s", commandName)
	}

	builder := &strings.Builder{}
	builder.WriteString("package main\n\n")
	builder.WriteString("import (\n")
	builder.WriteString("\t\"fmt\"\n")
	builder.WriteString("\t\"os\"\n")
	builder.WriteString("\t\"strings\"\n")
	builder.WriteString("\t\"sync\"\n\n")
	builder.WriteString("\t\"github.com/arcmantle/forge/helpers\"\n")
	builder.WriteString(")\n\n")
	builder.WriteString("func main() {\n")
	builder.WriteString("\tcmd := helpers.Command(\"__NAME__\", " + strconv.Quote(description) + ")\n")
	builder.WriteString("\tdryRun := cmd.Flag(\"dry-run\", \"Show what would run without executing steps\")\n")
	builder.WriteString("\tcmd.Parse()\n\n")
	builder.WriteString("\trunForge := func(args []string) error {\n")
	builder.WriteString("\t\tif len(args) == 0 {\n")
	builder.WriteString("\t\t\treturn fmt.Errorf(\"empty command step\")\n")
	builder.WriteString("\t\t}\n")
	builder.WriteString("\t\tif dryRun.Value {\n")
	builder.WriteString("\t\t\thelpers.Info(\"[dry-run] forge %s\", strings.Join(args, \" \"))\n")
	builder.WriteString("\t\t\treturn nil\n")
	builder.WriteString("\t\t}\n")
	builder.WriteString("\t\t_, err := helpers.ExecSimple(\"forge\", args, \"\")\n")
	builder.WriteString("\t\treturn err\n")
	builder.WriteString("\t}\n\n")

	for index, step := range command.Run {
		if len(step.Parallel) > 0 {
			parallelCommands := make([][]string, 0, len(step.Parallel))
			for _, parallel := range step.Parallel {
				args := tokenizeRunCommand(parallel)
				if len(args) == 0 {
					continue
				}
				parallelCommands = append(parallelCommands, args)
			}

			if len(parallelCommands) == 0 {
				continue
			}

			builder.WriteString("\t{\n")
			builder.WriteString("\t\tvar wg sync.WaitGroup\n")
			builder.WriteString("\t\terrCh := make(chan error, " + strconv.Itoa(len(parallelCommands)) + ")\n")
			for _, args := range parallelCommands {
				builder.WriteString("\t\twg.Add(1)\n")
				builder.WriteString("\t\tgo func(stepArgs []string) {\n")
				builder.WriteString("\t\t\tdefer wg.Done()\n")
				builder.WriteString("\t\t\tif err := runForge(stepArgs); err != nil {\n")
				builder.WriteString("\t\t\t\terrCh <- err\n")
				builder.WriteString("\t\t\t}\n")
				builder.WriteString("\t\t}(" + goStringSliceLiteral(args) + ")\n")
			}
			builder.WriteString("\t\twg.Wait()\n")
			builder.WriteString("\t\tclose(errCh)\n")
			builder.WriteString("\t\tfor err := range errCh {\n")
			builder.WriteString("\t\t\tif err != nil {\n")
			builder.WriteString("\t\t\t\thelpers.Error(\"composite parallel step failed: %v\", err)\n")
			builder.WriteString("\t\t\t\tos.Exit(1)\n")
			builder.WriteString("\t\t\t}\n")
			builder.WriteString("\t\t}\n")
			builder.WriteString("\t}\n\n")
			continue
		}

		args := append([]string{step.Command}, step.Args...)
		if len(args) == 0 || strings.TrimSpace(args[0]) == "" {
			continue
		}
		builder.WriteString("\tif err := runForge(" + goStringSliceLiteral(args) + "); err != nil {\n")
		builder.WriteString("\t\thelpers.Error(\"composite step " + strconv.Itoa(index+1) + " failed: %v\", err)\n")
		builder.WriteString("\t\tos.Exit(1)\n")
		builder.WriteString("\t}\n\n")
	}

	builder.WriteString("\thelpers.Success(\"composite command complete\")\n")
	builder.WriteString("}\n")

	return builder.String()
}

func tokenizeRunCommand(command string) []string {
	parts := strings.Fields(strings.TrimSpace(command))
	if len(parts) == 0 {
		return nil
	}

	return parts
}

func goStringSliceLiteral(values []string) string {
	if len(values) == 0 {
		return "[]string{}"
	}

	quoted := make([]string, 0, len(values))
	for _, value := range values {
		quoted = append(quoted, strconv.Quote(value))
	}

	return "[]string{" + strings.Join(quoted, ", ") + "}"
}
