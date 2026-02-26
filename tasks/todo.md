# Forge Roadmap

## Phase 1: VS Code Extension — `forge-vscode`

A lightweight extension that surfaces forge commands inside the editor.

### Scope

- [ ] Scaffold extension project (TypeScript, vscode extension API)
- [ ] Parse `forge.yaml` manifests (reuse schema, handle nested `:` commands)
- [ ] Auto-discover `.forge/scripts/` directories (mirror CLI discovery logic)
- [ ] **Tree view in sidebar** — show command hierarchy grouped by `:` prefix
  - Clicking a script-backed command navigates to the script file
  - Composite commands show their `run` steps as children
  - Icons distinguish script vs composite vs group
- [ ] **CodeLens on `forge.yaml`** — "Run | Open Script" above each command
- [ ] **Run from tree view** — right-click → "Run in Terminal"
- [ ] **Manifest discovery** — walk up from workspace root, merge like the CLI does
- [ ] Watch `forge.yaml` and `.forge/scripts/` for changes, refresh automatically
- [ ] Package and test locally

### Out of scope (intentionally)

- Command palette integration (terminal is fine)
- Custom output panels (forge's prefixed colored output works in the terminal)
- Duplicating `forge --docs` functionality

### Notes

- The extension is essentially: YAML parser + tree view + file opener + terminal launcher
- Should work in multi-root workspaces (each root may have its own `forge.yaml`)
- Use the existing `forge-schema.json` for validation reference

---

## Phase 2: Script Templates — `forge add --from`

Reusable script scaffolding, not a runtime package registry.

### Why templates instead of a package registry

Forge scripts are inherently **project-specific** — they interact with local filesystem
structure, tooling assumptions, and workflow conventions. A registry of runnable scripts
would be like a registry for Makefiles. The reusable unit should be a **starting point**
you customize, not a versioned dependency you update.

Compare:

- npm/crates/pip → general-purpose libraries with stable APIs → registry makes sense
- GitHub Actions → declarative workflows with isolation boundaries (containers) → registry makes sense
- Forge scripts → imperative code, no isolation, tightly coupled to project → **templates make sense**

### Design

- `forge add deploy --from=docker-compose` pulls a template from the gallery
- Template is copied into `.forge/scripts/`, user owns it from that point forward
- No versioning headaches, no update-breaking-my-local-changes
- Source can be a GitHub repo of template directories, or a simple URL

### Scope

- [ ] Define template format (directory structure, metadata file)
- [ ] `forge add <name> --from <source>` — fetch and scaffold from template
- [ ] Support `--from <url>` for arbitrary git repos / URLs
- [ ] Built-in template gallery (bundled with forge or fetched from a known repo)
- [ ] Template metadata: description, required runtimes, placeholder variables
- [ ] `forge templates` or `forge add --list-templates` to browse available templates

### Example templates to seed the gallery

- `monorepo-install` — parallel pnpm/npm install across workspace directories
- `docker-compose-deploy` — build + deploy via docker-compose
- `ci-lint-test` — parallel lint + test composite command
- `release` — version bump + changelog + tag + publish
- `db-migrate` — run database migrations with rollback support

---

## Phase 3: Shared Helper Libraries

Instead of sharing scripts (which are project-specific), share **helpers** (which are
general-purpose). The scripts stay local, but the utility functions become richer and
community-extensible.

### Rationale

- For Go: already natural — `go get` a module, import it in your script
- For TypeScript: extend the `#helpers` import map to support additional packages
- For C#: NuGet already handles this

The reusable unit is a **library**, not a workflow — which is a much better fit for a
package ecosystem. Instead of publishing a "deploy to AWS" script, you publish an `aws`
helper module that scripts can import.

### Scope

- [ ] Design how additional helper packages are declared and resolved
- [ ] Go: document pattern for importing third-party modules in forge scripts
- [ ] TypeScript: extend `.forge/package.json` to support additional dependencies
- [ ] C#: extend `.forge/ForgeScripts.csproj` to support NuGet references
- [ ] `forge setup helpers` or similar to install community helper packages
- [ ] Seed with useful helpers: AWS, Docker, Kubernetes, GitHub API, Slack notifications

---

## Phase 4: Curated Recipe Book

A documentation site with copy-pasteable forge script patterns. Zero infrastructure,
maximum reusability. Pairs with `forge --docs` already existing.

### Scope

- [ ] Set up a static docs site (can be part of forge's existing `--docs` or standalone)
- [ ] Write recipes for common patterns:
  - Parallel pnpm installs across a monorepo
  - Deploy script with rollback
  - CI pipeline (lint + test + build + deploy)
  - Docker image build and push
  - Database migration patterns
  - Release automation (version, changelog, tag, publish)
- [ ] Allow community contributions via PR
- [ ] Cross-reference with template gallery (Phase 2)

---

## Previous Work (Completed)

### Nested .forge Script Discovery

- [x] Evaluate feasibility and design priority semantics
- [x] Add `DiscoverScripts` and `discoverScriptsInDir` to `forge/internal/manifest/discover.go`
- [x] Update `getManifest()` in `forge/cmd/forge/main.go` to merge auto-discovered scripts
- [x] Update `forge/README.md` with auto-discovered scripts documentation
- [x] Build and verify compilation
