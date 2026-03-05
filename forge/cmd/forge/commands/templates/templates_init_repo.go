package templates

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/arcmantle/forge/internal/templates"
)

type templatesInitRepoOptions struct {
	name        string
	owner       string
	path        string
	description string
	private     bool
	dryRun      bool
}

type githubCreateUserRepoRequest struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Private     bool   `json:"private"`
	AutoInit    bool   `json:"auto_init"`
}

type githubCreateUserRepoResponse struct {
	Name     string `json:"name"`
	HTMLURL  string `json:"html_url"`
	CloneURL string `json:"clone_url"`
	Owner    struct {
		Login string `json:"login"`
	} `json:"owner"`
}

func RunTemplatesInitRepo(args []string) {
	opts := templatesInitRepoOptions{private: true}
	visibilitySet := false

	for i := 0; i < len(args); i++ {
		arg := args[i]
		switch {
		case arg == "--name":
			if i+1 >= len(args) {
				fmt.Fprintf(os.Stderr, "error: --name requires a value\n")
				os.Exit(1)
			}
			i++
			opts.name = strings.TrimSpace(args[i])
		case strings.HasPrefix(arg, "--name="):
			opts.name = strings.TrimSpace(strings.TrimPrefix(arg, "--name="))
		case arg == "--owner":
			if i+1 >= len(args) {
				fmt.Fprintf(os.Stderr, "error: --owner requires a value\n")
				os.Exit(1)
			}
			i++
			opts.owner = strings.TrimSpace(args[i])
		case strings.HasPrefix(arg, "--owner="):
			opts.owner = strings.TrimSpace(strings.TrimPrefix(arg, "--owner="))
		case arg == "--path":
			if i+1 >= len(args) {
				fmt.Fprintf(os.Stderr, "error: --path requires a value\n")
				os.Exit(1)
			}
			i++
			opts.path = strings.TrimSpace(args[i])
		case strings.HasPrefix(arg, "--path="):
			opts.path = strings.TrimSpace(strings.TrimPrefix(arg, "--path="))
		case arg == "--description":
			if i+1 >= len(args) {
				fmt.Fprintf(os.Stderr, "error: --description requires a value\n")
				os.Exit(1)
			}
			i++
			opts.description = strings.TrimSpace(args[i])
		case strings.HasPrefix(arg, "--description="):
			opts.description = strings.TrimSpace(strings.TrimPrefix(arg, "--description="))
		case arg == "--private":
			if visibilitySet && !opts.private {
				fmt.Fprintf(os.Stderr, "error: --private cannot be combined with --public\n")
				os.Exit(1)
			}
			visibilitySet = true
			opts.private = true
		case arg == "--public":
			if visibilitySet && opts.private {
				fmt.Fprintf(os.Stderr, "error: --public cannot be combined with --private\n")
				os.Exit(1)
			}
			visibilitySet = true
			opts.private = false
		case arg == "--dry-run":
			opts.dryRun = true
		default:
			fmt.Fprintf(os.Stderr, "error: unknown flag '%s'\n", arg)
			fmt.Fprintf(os.Stderr, "  usage: %s\n", templatesUsageLine)
			os.Exit(1)
		}
	}

	if opts.name == "" {
		fmt.Fprintf(os.Stderr, "error: --name is required\n")
		fmt.Fprintf(os.Stderr, "  usage: %s\n", templatesUsageLine)
		os.Exit(1)
	}
	if strings.Contains(opts.name, "/") || strings.Contains(opts.name, " ") {
		fmt.Fprintf(os.Stderr, "error: invalid repo name '%s'\n", opts.name)
		os.Exit(1)
	}

	token, err := templates.ResolveGitHubToken()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error resolving github token: %v\n", err)
		os.Exit(1)
	}

	login, err := githubGetAuthenticatedLogin(token)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error resolving github user: %v\n", err)
		os.Exit(1)
	}

	owner := strings.TrimSpace(opts.owner)
	if owner == "" {
		owner = login
	}
	if owner != login {
		fmt.Fprintf(os.Stderr, "error: --owner currently supports only your own GitHub account (%s)\n", login)
		os.Exit(1)
	}

	targetPath := strings.TrimSpace(opts.path)
	if targetPath == "" {
		targetPath = filepath.Join(".", opts.name)
	}
	absPath, err := filepath.Abs(targetPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error resolving path '%s': %v\n", targetPath, err)
		os.Exit(1)
	}

	description := strings.TrimSpace(opts.description)
	if description == "" {
		description = fmt.Sprintf("Forge template registry for %s", owner)
	}

	repoURL := fmt.Sprintf("https://github.com/%s/%s", owner, opts.name)
	if opts.dryRun {
		fmt.Printf("Dry run for template registry repo init '\033[36m%s/%s\033[0m'\n", owner, opts.name)
		fmt.Printf("  visibility: %s\n", visibilityLabel(opts.private))
		fmt.Printf("  local path: %s\n", absPath)
		fmt.Printf("  repo url:   %s\n", repoURL)
		fmt.Println("  workflows:  .github/workflows/forge-template-publish-pr.yml")
		fmt.Println("              .github/workflows/forge-template-tag-on-scope-merge.yml")
		fmt.Println("  actions:    create github repo, scaffold files, initialize git, push main")
		return
	}

	if err := ensureEmptyOrMissingDir(absPath); err != nil {
		fmt.Fprintf(os.Stderr, "error preparing local path: %v\n", err)
		os.Exit(1)
	}

	repoResponse, err := githubCreateUserRepository(token, opts.name, description, opts.private)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error creating github repository: %v\n", err)
		os.Exit(1)
	}

	if err := scaffoldTemplateRegistryRepo(absPath, owner, opts.name); err != nil {
		fmt.Fprintf(os.Stderr, "error scaffolding local repo: %v\n", err)
		os.Exit(1)
	}

	if err := initializeAndPushTemplateRegistryRepo(absPath, owner, opts.name, login, token); err != nil {
		fmt.Fprintf(os.Stderr, "error initializing/pushing template repo: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Initialized Forge template registry '\033[36m%s/%s\033[0m'\n", owner, opts.name)
	fmt.Printf("  repo:      %s\n", strings.TrimSpace(repoResponse.HTMLURL))
	fmt.Printf("  clone:     %s\n", strings.TrimSpace(repoResponse.CloneURL))
	fmt.Printf("  local:     %s\n", absPath)
	fmt.Printf("  visibility:%s %s\n", " ", visibilityLabel(opts.private))
	fmt.Println("  workflows: .github/workflows/forge-template-publish-pr.yml")
	fmt.Println("             .github/workflows/forge-template-tag-on-scope-merge.yml")
	fmt.Println()
	fmt.Printf("Publish to this registry with:\n  forge templates publish <command> --version v1.0.0 --registry %s\n", strings.TrimSpace(repoResponse.HTMLURL))
}

func githubCreateUserRepository(token string, name string, description string, private bool) (*githubCreateUserRepoResponse, error) {
	requestBody := githubCreateUserRepoRequest{
		Name:        name,
		Description: description,
		Private:     private,
		AutoInit:    false,
	}

	payload, _, err := githubRequest(token, "POST", "/user/repos", requestBody, 201)
	if err != nil {
		return nil, err
	}

	var response githubCreateUserRepoResponse
	if err := json.Unmarshal(payload, &response); err != nil {
		return nil, fmt.Errorf("decoding github create repo response: %w", err)
	}

	if strings.TrimSpace(response.Name) == "" || strings.TrimSpace(response.Owner.Login) == "" {
		return nil, fmt.Errorf("github create repository response missing owner/name")
	}

	return &response, nil
}

func ensureEmptyOrMissingDir(path string) error {
	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return os.MkdirAll(path, 0o755)
		}
		return err
	}

	if !info.IsDir() {
		return fmt.Errorf("path '%s' exists and is not a directory", path)
	}

	entries, err := os.ReadDir(path)
	if err != nil {
		return err
	}
	if len(entries) > 0 {
		return fmt.Errorf("path '%s' already exists and is not empty", path)
	}

	return nil
}

func scaffoldTemplateRegistryRepo(path string, owner string, name string) error {
	workflowsDir := filepath.Join(path, ".github", "workflows")
	if err := os.MkdirAll(workflowsDir, 0o755); err != nil {
		return err
	}

	if err := os.WriteFile(filepath.Join(path, "README.md"), []byte(renderTemplateRegistryReadme(owner, name)), 0o644); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(path, ".gitignore"), []byte(".DS_Store\nThumbs.db\n"), 0o644); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(workflowsDir, "forge-template-publish-pr.yml"), []byte(forgeTemplatePublishPRWorkflow), 0o644); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(workflowsDir, "forge-template-tag-on-scope-merge.yml"), []byte(forgeTemplateTagWorkflow), 0o644); err != nil {
		return err
	}

	return nil
}

func initializeAndPushTemplateRegistryRepo(path string, owner string, name string, login string, token string) error {
	if _, err := runGit("", "init", "--initial-branch=main", path); err != nil {
		return err
	}

	email := fmt.Sprintf("%s@users.noreply.github.com", sanitizeGitRefSegment(login))
	if _, err := runGit(path, "config", "user.name", login); err != nil {
		return err
	}
	if _, err := runGit(path, "config", "user.email", email); err != nil {
		return err
	}

	if _, err := runGit(path, "add", "-A"); err != nil {
		return err
	}
	if _, err := runGit(path, "commit", "-m", "Initialize Forge template registry"); err != nil {
		return err
	}

	remoteURL := fmt.Sprintf("https://github.com/%s/%s.git", owner, name)
	if _, err := runGit(path, "remote", "add", "origin", remoteURL); err != nil {
		return err
	}

	if err := gitPushMainWithToken(path, token); err != nil {
		return err
	}

	return nil
}

func gitPushMainWithToken(repoDir string, token string) error {
	authHeader := base64.StdEncoding.EncodeToString([]byte("x-access-token:" + strings.TrimSpace(token)))
	extraHeader := fmt.Sprintf("http.https://github.com/.extraheader=AUTHORIZATION: basic %s", authHeader)
	cmd := exec.Command("git", "-C", repoDir, "-c", extraHeader, "push", "-u", "origin", "main")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git push failed: %w: %s", err, strings.TrimSpace(string(output)))
	}

	return nil
}

func visibilityLabel(private bool) string {
	if private {
		return "private"
	}
	return "public"
}

func renderTemplateRegistryReadme(owner string, name string) string {
	return fmt.Sprintf(`# %s

Forge template registry repository.

## Registry URL

https://github.com/%s/%s

## Publish from Forge

Use forge publish against this registry:

`+"```bash"+`
forge templates publish <command> --version v1.0.0 --registry https://github.com/%s/%s
`+"```"+`

For GitHub registries, forge opens a PR into the scope branch (`+"`<github-login>`"+` by default, or `+"`--scope`"+`).

## Included Workflows

- `+"`forge-template-publish-pr.yml`"+`: validates publish PR payload and auto-merges valid publish PRs.
- `+"`forge-template-tag-on-scope-merge.yml`"+`: tags scope-branch publish commits as `+"`<scope>/<template>/<version>`"+`.

`, name, owner, name, owner, name)
}

const forgeTemplatePublishPRWorkflow = `name: Forge Template Publish PR

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: write
  pull-requests: write

jobs:
  validate-and-merge:
    if: startsWith(github.event.pull_request.title, 'publish template ')
    runs-on: ubuntu-latest
    steps:
      - name: Validate publish pull request
        uses: actions/github-script@v7
        with:
          script: |
            const pr = context.payload.pull_request;
            if (pr.draft) {
              core.setFailed('Publish pull request is draft.');
              return;
            }

						if (pr.head.repo.full_name !== context.repo.owner + '/' + context.repo.repo) {
              core.setFailed('Publish pull request must come from this repository.');
              return;
            }

            const titleMatch = /^publish template\s+(.+?)@([^\s]+)$/.exec(pr.title.trim());
            if (!titleMatch) {
              core.setFailed('Pull request title must match: publish template <template>@<version>');
              return;
            }

            const expectedTemplate = titleMatch[1].trim();
            const expectedVersion = titleMatch[2].trim();
            const baseBranch = pr.base.ref;
            const author = pr.user.login;

            if (baseBranch !== author) {
							core.setFailed("Base branch '" + baseBranch + "' must match pull request author '" + author + "'.");
              return;
            }

            const files = await github.paginate(github.rest.pulls.listFiles, {
              owner: context.repo.owner,
              repo: context.repo.repo,
              pull_number: pr.number,
              per_page: 100,
            });

            if (files.length === 0) {
              core.setFailed('Publish pull request has no file changes.');
              return;
            }

            const templateDirs = new Set();
            let hasTemplateYaml = false;
            let hasScript = false;

            for (const file of files) {
              const parts = file.filename.split('/');
              if (parts.length !== 2) {
								core.setFailed("Invalid path '" + file.filename + "'. Expected '<template>/<file>'.");
                return;
              }

              const [templateDir, leaf] = parts;
              templateDirs.add(templateDir);

              const allowed = new Set([
                'template.yaml',
                'example.md',
								templateDir + '.go',
								templateDir + '.ts',
								templateDir + '.cs',
              ]);

              if (!allowed.has(leaf)) {
								core.setFailed("Invalid file '" + file.filename + "'.");
                return;
              }

              if (leaf === 'template.yaml') {
                hasTemplateYaml = true;
              }
              if (leaf.endsWith('.go') || leaf.endsWith('.ts') || leaf.endsWith('.cs')) {
                hasScript = true;
              }
            }

            if (templateDirs.size !== 1) {
              core.setFailed('Publish pull request must update exactly one template directory.');
              return;
            }

            const changedTemplate = [...templateDirs][0];
            if (changedTemplate !== expectedTemplate) {
							core.setFailed("Changed template directory '" + changedTemplate + "' does not match PR title template '" + expectedTemplate + "'.");
              return;
            }

            if (!hasTemplateYaml) {
              core.setFailed('Publish pull request must include template.yaml.');
              return;
            }
            if (!hasScript) {
              core.setFailed('Publish pull request must include at least one script file.');
              return;
            }

			core.notice('Validated publish PR for ' + baseBranch + '/' + expectedTemplate + '@' + expectedVersion);

      - name: Merge publish pull request
        uses: actions/github-script@v7
        with:
          script: |
            const prNumber = context.payload.pull_request.number;
            await github.rest.pulls.merge({
              owner: context.repo.owner,
              repo: context.repo.repo,
              pull_number: prNumber,
              merge_method: 'squash',
            });
						core.notice('Merged publish pull request #' + prNumber);
`

const forgeTemplateTagWorkflow = `name: Forge Template Tag On Scope Merge

on:
  push:
    branches-ignore:
      - main

permissions:
  contents: write

jobs:
  tag-publish:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Create package tag from publish commit
        shell: bash
        run: |
          set -euo pipefail

          commit_message="$(git log -1 --pretty=%s)"
          if [[ ! "$commit_message" =~ ^publish\ template\ (.+)@([^[:space:]]+)$ ]]; then
            echo "Not a forge publish commit. Skipping."
            exit 0
          fi

          template="${BASH_REMATCH[1]}"
          version="${BASH_REMATCH[2]}"
          scope="${GITHUB_REF_NAME}"
          tag="${scope}/${template}/${version}"

          git fetch --tags --force
          if git rev-parse -q --verify "refs/tags/${tag}" >/dev/null; then
            echo "Tag ${tag} already exists. Skipping."
            exit 0
          fi

          git config user.name "forge-bot"
          git config user.email "forge-bot@users.noreply.github.com"

          git tag "${tag}" "${GITHUB_SHA}"
          git push origin "refs/tags/${tag}"

          echo "Created tag ${tag}"
`
