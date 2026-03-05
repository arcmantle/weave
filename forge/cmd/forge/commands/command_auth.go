package commands

import (
	"fmt"
	"os"
	"strings"

	"github.com/arcmantle/forge/internal/templates"
)

func runAuth(args []string) {
	if len(args) == 0 {
		fmt.Fprintf(os.Stderr, "error: forge auth requires a provider\n")
		fmt.Fprintf(os.Stderr, "  usage: %s\n", authGitHubUsageLine)
		os.Exit(1)
	}

	provider := strings.TrimSpace(args[0])
	if provider != "github" {
		fmt.Fprintf(os.Stderr, "error: unsupported auth provider '%s'\n", provider)
		fmt.Fprintf(os.Stderr, "  supported: github\n")
		os.Exit(1)
	}

	tokenArg := ""
	clientIDArg := ""
	scopesArg := ""
	clearToken := false
	showStatus := false
	browserLogin := false
	showHelp := false
	hasNonHelpFlag := false
	for i := 1; i < len(args); i++ {
		arg := args[i]
		switch {
		case arg == "--help" || arg == "-h":
			showHelp = true
		case arg == "--clear":
			hasNonHelpFlag = true
			clearToken = true
		case arg == "--status":
			hasNonHelpFlag = true
			showStatus = true
		case arg == "--browser":
			hasNonHelpFlag = true
			browserLogin = true
		case arg == "--token":
			hasNonHelpFlag = true
			if i+1 >= len(args) {
				fmt.Fprintf(os.Stderr, "error: --token requires a value\n")
				os.Exit(1)
			}
			i++
			tokenArg = args[i]
		case strings.HasPrefix(arg, "--token="):
			hasNonHelpFlag = true
			tokenArg = strings.TrimPrefix(arg, "--token=")
		case arg == "--client-id":
			hasNonHelpFlag = true
			if i+1 >= len(args) {
				fmt.Fprintf(os.Stderr, "error: --client-id requires a value\n")
				os.Exit(1)
			}
			i++
			clientIDArg = args[i]
		case strings.HasPrefix(arg, "--client-id="):
			hasNonHelpFlag = true
			clientIDArg = strings.TrimPrefix(arg, "--client-id=")
		case arg == "--scopes":
			hasNonHelpFlag = true
			if i+1 >= len(args) {
				fmt.Fprintf(os.Stderr, "error: --scopes requires a value\n")
				os.Exit(1)
			}
			i++
			scopesArg = args[i]
		case strings.HasPrefix(arg, "--scopes="):
			hasNonHelpFlag = true
			scopesArg = strings.TrimPrefix(arg, "--scopes=")
		default:
			fmt.Fprintf(os.Stderr, "error: unknown flag '%s'\n", arg)
			fmt.Fprintf(os.Stderr, "  usage: %s\n", authGitHubUsageLine)
			os.Exit(1)
		}
	}

	if showHelp {
		if hasNonHelpFlag {
			fmt.Fprintf(os.Stderr, "error: --help cannot be combined with other auth flags\n")
			os.Exit(1)
		}
		fmt.Println(authGitHubHelpText)
		return
	}

	if clearToken && (tokenArg != "" || browserLogin || clientIDArg != "" || scopesArg != "") {
		fmt.Fprintf(os.Stderr, "error: --clear cannot be combined with other auth flags\n")
		os.Exit(1)
	}

	if showStatus && (clearToken || tokenArg != "" || browserLogin || clientIDArg != "" || scopesArg != "") {
		fmt.Fprintf(os.Stderr, "error: --status cannot be combined with other auth flags\n")
		os.Exit(1)
	}

	if tokenArg != "" && (browserLogin || clientIDArg != "" || scopesArg != "") {
		fmt.Fprintf(os.Stderr, "error: --token cannot be combined with --browser, --client-id, or --scopes\n")
		os.Exit(1)
	}

	if !browserLogin && (clientIDArg != "" || scopesArg != "") {
		fmt.Fprintf(os.Stderr, "error: --client-id and --scopes require --browser\n")
		os.Exit(1)
	}

	if showStatus {
		envConfigured, configConfigured, configPath, err := templates.GitHubTokenStatus()
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			os.Exit(1)
		}

		fmt.Println("GitHub auth status:")
		fmt.Printf("  env (GITHUB_TOKEN): %s\n", boolLabel(envConfigured))
		fmt.Printf("  config token:        %s\n", boolLabel(configConfigured))
		fmt.Printf("  config path:         %s\n", configPath)
		return
	}

	if clearToken {
		if err := templates.ClearGitHubToken(); err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("GitHub token cleared.")
		return
	}

	if tokenArg != "" {
		if err := templates.SaveGitHubToken(tokenArg); err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("GitHub token saved.")
		return
	}

	if browserLogin {
		clientID := strings.TrimSpace(clientIDArg)
		if clientID == "" {
			clientID = strings.TrimSpace(os.Getenv("GITHUB_OAUTH_CLIENT_ID"))
		}
		if clientID == "" {
			clientID = templates.DefaultGitHubOAuthClientID()
		}
		if clientID == "" {
			fmt.Fprintf(os.Stderr, "error: GitHub browser auth requires OAuth App client ID\n")
			fmt.Fprintf(os.Stderr, "  provide --client-id <id>, set GITHUB_OAUTH_CLIENT_ID, or use a forge build with embedded default client ID\n")
			os.Exit(1)
		}

		scopes := parseGitHubOAuthScopes(scopesArg)
		if _, err := templates.LoginGitHubWithDeviceFlow(clientID, scopes, true); err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("GitHub browser authentication completed.")
		return
	}

	if _, err := templates.PromptAndSaveGitHubToken(); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}

func parseGitHubOAuthScopes(raw string) []string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return []string{"repo"}
	}

	parts := strings.Split(trimmed, ",")
	seen := map[string]bool{}
	var scopes []string
	for _, part := range parts {
		scope := strings.TrimSpace(part)
		if scope == "" || seen[scope] {
			continue
		}
		seen[scope] = true
		scopes = append(scopes, scope)
	}

	if len(scopes) == 0 {
		return []string{"repo"}
	}

	return scopes
}

func boolLabel(v bool) string {
	if v {
		return "configured"
	}

	return "not configured"
}
