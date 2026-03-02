# Forge Roadmap

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

- [x] Define template format (directory structure, metadata file)
- [x] `forge add <name> --from <source>` — fetch and scaffold from template
- [x] Support `--from <url>` for arbitrary git repos / URLs
- [x] Built-in template gallery (bundled with forge or fetched from a known repo)
- [x] Template metadata: description, required runtimes, placeholder variables
- [x] `forge templates` or `forge add --list-templates` to browse available templates

### Example templates to seed the gallery

- `monorepo-install` — parallel pnpm/npm install across workspace directories
- `docker-compose-deploy` — build + deploy via docker-compose
- `ci-lint-test` — parallel lint + test composite command
- `release` — version bump + changelog + tag + publish
- `db-migrate` — run database migrations with rollback support

---

## Phase 2b: Template Registries & Docs Integration

Configurable template registries and docs UI for browsing templates.

### Scope

- [x] Add `registries` field to `Manifest` struct with merge/deduplication across inherited manifests
- [x] Create registry loading system (`external.go`) — local dirs, git URLs, optional `registry.yaml` index
- [x] Update template resolution order: built-in → registries → local → git URL
- [x] Update `forge templates` CLI to show grouped output by source (built-in, registry names)
- [x] Update `forge add --from` to resolve from registries
- [x] Extend docs backend (`DocData`) with template info from `ListAllTemplates`
- [x] Create `forge-templates.js` web component for template detail view
- [x] Integrate templates into docs sidebar with search, grouping, and click-to-view
- [x] Add template-specific CSS styles (badges, chips, groups, detail panel)
- [x] Update README with registry configuration, format, and docs feature documentation

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

### Script Templates — `forge add --from`

- [x] Define template format (directory structure, metadata file)
- [x] `forge add <name> --from <source>` — fetch and scaffold from template
- [x] Support `--from <url>` for arbitrary git repos / URLs
- [x] Built-in template gallery (bundled with forge or fetched from a known repo)
- [x] Template metadata: description, required runtimes, placeholder variables
- [x] `forge templates` — list available templates with descriptions and variables

### Nested .forge Script Discovery

- [x] Evaluate feasibility and design priority semantics
- [x] Add `DiscoverScripts` and `discoverScriptsInDir` to `forge/internal/manifest/discover.go`
- [x] Update `getManifest()` in `forge/cmd/forge/main.go` to merge auto-discovered scripts
- [x] Update `forge/README.md` with auto-discovered scripts documentation
- [x] Build and verify compilation
