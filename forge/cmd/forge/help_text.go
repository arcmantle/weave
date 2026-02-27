package main

const authGitHubUsageLine = "forge auth github [--token <token>] [--clear] [--status]"

const mainUsageText = `forge — universal repo script runner

Usage:
  forge <command> [args...]
  forge --list              List available commands
  forge --docs              Open interactive documentation
  forge --help              Show this help
  forge --version           Show version
  forge init                Scaffold forge.yaml and .forge/ directory
  forge add <name> [--lang] Add a new script (go, ts, cs — default: go)
  forge add <name> --from   Create a script from a template
  forge templates           List available script templates
  forge auth github         Configure GitHub token for registry GraphQL
  forge setup <runtime>     Add scaffolding for a runtime (go, ts, cs)
  forge help <command>      Show detailed help for a command

Commands are defined in forge.yaml and executed from .forge/scripts.
Scripts in .forge/scripts/ are also auto-discovered without YAML entries.
Manifests and scripts are discovered by walking up from the current
directory, allowing hierarchical command definitions.
The --docs and --list commands also discover manifests in subdirectories.`

const authHelpText = `forge auth

Usage:
  forge auth github

Description:
  Authentication helpers for external providers.`

const authGitHubHelpText = `forge auth github

Usage:
  forge auth github
  forge auth github --token <token>
  forge auth github --clear
  forge auth github --status

Description:
  Configures the GitHub token used for GraphQL-based template registry metadata.
  Without --token, forge prompts for the token and stores it in the user config.
  With --token, forge stores the provided value directly.
  With --clear, forge removes the saved token from config and environment.
  With --status, forge reports whether token sources are configured.`
