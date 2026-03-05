package commands

import (
	"fmt"
	"os"
	"strings"

	cmdtemplates "github.com/arcmantle/forge/cmd/forge/commands/templates"
	"github.com/arcmantle/forge/internal/manifest"
	templatelib "github.com/arcmantle/forge/internal/templates"
)

func runTemplates(args []string) {
	if len(args) > 0 {
		switch args[0] {
		case "publish":
			cmdtemplates.RunTemplatesPublish(args[1:])
			return
		case "init-repo":
			cmdtemplates.RunTemplatesInitRepo(args[1:])
			return
		case "help", "--help", "-h":
			fmt.Println(templatesHelpText)
			return
		default:
			fmt.Fprintf(os.Stderr, "error: unknown templates subcommand '%s'\n", args[0])
			fmt.Fprintf(os.Stderr, "  usage: %s\n", templatesUsageLine)
			os.Exit(1)
		}
	}

	registries := collectRegistries()
	allTemplates := templatelib.ListAllTemplates(registries)

	if len(allTemplates) == 0 {
		fmt.Println("No templates available.")
		return
	}

	fmt.Println("Available templates:")

	groups := map[string][]templatelib.TemplateInfo{}
	var sourceOrder []string
	for _, t := range allTemplates {
		if _, ok := groups[t.Source]; !ok {
			sourceOrder = append(sourceOrder, t.Source)
		}
		groups[t.Source] = append(groups[t.Source], t)
	}

	for _, source := range sourceOrder {
		tpls := groups[source]
		sourceType := ""
		if len(tpls) > 0 {
			sourceType = templateSourceTypeLabel(tpls[0].SourceType)
		}

		fmt.Println()
		if source == "built-in" {
			fmt.Printf("  \033[33m[built-in]\033[0m")
		} else {
			fmt.Printf("  \033[33m[%s]\033[0m", source)
		}
		if sourceType != "" {
			fmt.Printf(" \033[90m(%s)\033[0m", sourceType)
		}
		fmt.Println()

		maxNameLen := 0
		for _, t := range tpls {
			if len(t.Name) > maxNameLen {
				maxNameLen = len(t.Name)
			}
		}

		for _, t := range tpls {
			langs := strings.Join(t.Languages, ", ")
			description := t.Description
			if t.LatestTag != "" {
				description = fmt.Sprintf("%s \033[90m(latest: %s)\033[0m", t.Description, t.LatestTag)
			}
			fmt.Printf("    \033[36m%-*s\033[0m  %s \033[90m(%s)\033[0m\n", maxNameLen, t.Name, description, langs)

			if len(t.Variables) > 0 {
				for _, v := range t.Variables {
					defStr := ""
					if v.Default != "" {
						defStr = fmt.Sprintf(" \033[90m(default: %s)\033[0m", v.Default)
					}
					fmt.Printf("    %-*s    --var %s=<value>%s\n", maxNameLen, "", v.Name, defStr)
				}
			}
		}
	}

	fmt.Println()
	fmt.Println("Usage:")
	fmt.Println("  forge add <name> --from <template[@ref]> [--go|--ts|--cs] [--var key=value]")
	fmt.Println()
	fmt.Println("Pin a registry template version with @tag:")
	fmt.Println("  forge add deploy --from deploy-k8s@v1.2.0")
	fmt.Println()
	fmt.Println("Templates can also be loaded from local directories or git URLs:")
	fmt.Println("  forge add deploy --from ./my-templates/deploy")
	fmt.Println("  forge add deploy --from https://github.com/user/repo#path/to/template")
	fmt.Println()
	fmt.Println("Configure registries in .forge/config.yaml:")
	fmt.Println("  registries:")
	fmt.Println("    - https://github.com/user/forge-templates")
	fmt.Println("    - ./local-templates")
}

func collectRegistries() []string {
	cwd, err := os.Getwd()
	if err != nil {
		return nil
	}

	manifests, err := manifest.DiscoverScripts(cwd)
	if err != nil || len(manifests) == 0 {
		return nil
	}

	merged := manifest.Merge(manifests)
	return merged.Registries
}

func templateSourceTypeLabel(sourceType string) string {
	switch strings.TrimSpace(sourceType) {
	case "built-in":
		return "built-in"
	case "github-git":
		return "github-git"
	case "local-git":
		return "local-git"
	case "folder-index":
		return "folder-index"
	case "folder-scan":
		return "folder-scan"
	default:
		return ""
	}
}
