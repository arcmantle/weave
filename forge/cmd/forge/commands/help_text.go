package commands

import "fmt"

const authGitHubUsageLine = "forge auth github [--token <token> | --browser [--client-id <id>] [--scopes <comma-separated>] | --clear | --status]"
const templatesUsageLine = "forge templates [publish <command> --version <version> [--registry <path-or-url>] [--template <name>] [--scope <branch>] [--description <text>] [--message <text>] [--dry-run] | init-repo --name <repo-name> [--owner <owner>] [--path <dir>] [--private|--public] [--description <text>] [--dry-run]]"

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
  forge templates init-repo Scaffold and push a GitHub template registry repo
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
  forge auth github --browser
  forge auth github --browser --client-id <oauth-client-id>
  forge auth github --browser --scopes repo,workflow
  forge auth github --clear
  forge auth github --status

Description:
  Configures the GitHub token used for GraphQL-based template registry metadata.
  Without --token, forge prompts for the token and stores it in the user config.
  With --browser, forge runs GitHub Device Flow in the browser and stores the returned token.
  --browser uses an embedded default OAuth client ID in official builds.
  You can override with --client-id or GITHUB_OAUTH_CLIENT_ID.
  --scopes is optional with --browser (default: repo).
  With --token, forge stores the provided value directly.
  With --clear, forge removes the saved token from config and environment.
  With --status, forge reports whether token sources are configured.`

const templatesHelpText = `forge templates

Usage:
  forge templates
  forge templates publish <command> --version <version> [--registry <path-or-url>] [--template <name>] [--scope <branch>] [--description <text>] [--message <text>] [--dry-run]
  forge templates init-repo --name <repo-name> [--owner <owner>] [--path <dir>] [--private|--public] [--description <text>] [--dry-run]

Description:
  Lists templates from built-in and configured registries.
  The publish subcommand snapshots an existing command script into a git-backed registry format.

Publish behavior:
  - For non-GitHub registries, publishes to branch: <template-name>
  - For non-GitHub registries, creates tag: <template-name>/<version>
  - For non-GitHub registries, writes template files at branch root: template.yaml and <template-name>.(go|ts|cs)
  - For GitHub registries, publish opens a PR to scope branch <github-login> (or --scope)
  - For GitHub registries, template files are written under <template-name>/ and tags are expected to be created by repository workflow after merge
  - Composite commands publish as bundle templates with run metadata and child command templates/scripts
  - Script-based commands are copied as-is (no automatic placeholder rewriting)
  - If requested tag exists with different content hash, publish auto-bumps patch version
  - If requested tag exists with same content hash, publish reports already published and exits
  - With --dry-run, shows planned publish actions without commit/push/PR creation

Examples:
  forge templates
  forge templates publish deploy --version v1.2.0
  forge templates publish deploy --version v1.2.1 --registry ../forge-template-registry
  forge templates publish deploy --version v1.2.2 --template deploy-k8s --description "Kubernetes deploy template"
  forge templates publish deploy --version v1.2.3 --registry https://github.com/org/forge-templates --scope your-github-login
  forge templates init-repo --name my-forge-templates
  forge templates init-repo --name my-forge-templates --public --path ./my-forge-templates`

func printUsage() {
	fmt.Println(mainUsageText)
}
