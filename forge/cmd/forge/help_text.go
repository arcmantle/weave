package main

const authGitHubUsageLine = "forge auth github [--token <token>] [--clear] [--status]"
const templatesUsageLine = "forge templates [publish <command> --version <version> [--registry <path-or-url>] [--template <name>] [--description <text>] [--message <text>] [--lang <go>] [--dry-run]]"

const mainUsageText = `forge — universal repo script runner

Usage:
  forge <command> [args...]
  forge --list              List available commands
  forge --docs              Open interactive documentation
  forge --help              Show this help
  forge --version           Show version
  forge init                Scaffold .forge/ command scripts directory
  forge add <name> [--lang] Add a new script (go, ts, cs — default: go)
  forge add <name> --from   Create a script from a template
  forge templates           List available script templates
  forge templates publish   Publish a command as a template
  forge auth github         Configure GitHub token for registry GraphQL
  forge setup <runtime>     Add scaffolding for a runtime (go, ts, cs)
  forge help <command>      Show detailed help for a command

Commands are defined by .forge/scripts/**/template.yaml files.
Nested folders map to nested command names (e.g. deploy/prod -> deploy:prod).
Scripts are discovered by walking up from the current directory.
The --docs and --list commands also discover script trees in subdirectories.`

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

const templatesHelpText = `forge templates

Usage:
  forge templates
  forge templates publish <command> --version <version> [--registry <path-or-url>] [--template <name>] [--description <text>] [--message <text>] [--lang <go>] [--dry-run]

Description:
  Lists templates from built-in and configured registries.
  The publish subcommand snapshots an existing command script into a branch-per-template registry format.

Publish behavior:
  - Publishes to branch: <template-name>
  - Creates tag: <template-name>/<version>
  - Writes template files at branch root: template.yaml and <template-name>.(go|ts|cs)
  - Composite commands (run steps) are published as generated wrapper scripts (currently go)
  - Script-based commands are copied as-is (no automatic placeholder rewriting)
  - If requested tag exists with different content hash, publish auto-bumps patch version
  - If requested tag exists with same content hash, publish reports already published and exits
  - With --dry-run, shows planned publish actions without commit/tag/push

Examples:
  forge templates
  forge templates publish deploy --version v1.2.0
  forge templates publish deploy --version v1.2.1 --registry ../forge-template-registry
  forge templates publish deploy --version v1.2.2 --template deploy-k8s --description "Kubernetes deploy template"`
