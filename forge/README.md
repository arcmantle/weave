# forge

Universal repo script runner. Write scripts in **Go**, **TypeScript**, or **C#** — forge compiles, caches, and runs them with zero config.

## Install

```bash
# Global install
npm install -g @arcmantle/forge

# Or run directly
npx @arcmantle/forge
```

## Quick Start

```bash
# Scaffold a new project
forge init

# Add a script
forge add hello

# Run it
forge hello
```

`forge init` creates a `forge.yaml` manifest and `.forge/` directory with helpers and schema. Scripts go in `.forge/scripts/<name>/`.

## forge.yaml

Commands are defined in `forge.yaml` at the root of your project. Each command either points to a script file or composes other commands.

```yaml
# yaml-language-server: $schema=.forge/forge-schema.json
commands:
  install:
    description: "Install all dependencies"
    script: .forge/scripts/install/install.go

  build:
    description: "Build the project"
    script: .forge/scripts/build/build.ts

  deploy:
    description: "Build then deploy"
    run:
      - build
      - deploy-prod

  ci:
    description: "Run linting and tests in parallel"
    run:
      - parallel: [lint, test]

registries:
  - https://github.com/org/forge-templates
  - ./local-templates
```

The schema comment on line 1 enables IDE autocompletion and validation.

### Command Properties

| Property | Type | Description |
| --- | --- | --- |
| `description` | `string` | Shown in `forge --list` |
| `script` | `string` | Path to `.go`, `.ts`, or `.cs` script file |
| `run` | `array` | Sequential steps — strings or `parallel: [...]` blocks |

A command must have either `script` or `run`, not both.

### Composite Commands

Sequential steps run one after another. Parallel blocks run concurrently with prefixed, color-coded output:

```yaml
commands:
  pipeline:
    run:
      - clean                           # step 1: sequential
      - parallel: [build-api, build-ui] # step 2: parallel
      - deploy                          # step 3: sequential
```

Forge detects cycles in composite commands and errors before execution.

#### Step Arguments

Steps can carry arguments — either inline in the string or via the explicit object form:

```yaml
commands:
  ci:
    run:
      - "lint --fix"                     # inline args (string form)
      - command: test                    # explicit object form
        args: [--coverage, --reporter, junit]
      - parallel:
          - "build:api --production"     # inline args in parallel entries
          - build:ui
```

**Forwarding rules:**

- Steps **with** explicit or inline args use those — no forwarding from the composite invocation.
- Steps **without** args receive whatever CLI args were passed to the composite command (backward compatible).
- Parallel entries follow the same rule independently — each entry either uses its own inline args or receives the composite's forwarded args.

### Nested Commands

Commands with `:` in their name form groups. On the CLI, spaces are resolved as nested command names using greedy longest-match:

```yaml
commands:
  deploy:staging:
    description: "Deploy to staging"
    script: .forge/scripts/deploy-staging/deploy-staging.go

  deploy:prod:
    description: "Deploy to production"
    script: .forge/scripts/deploy-prod/deploy-prod.go
```

```bash
forge deploy staging --dryrun   # resolves to deploy:staging with args [--dryrun]
forge deploy prod               # resolves to deploy:prod
forge help deploy               # lists available subcommands (staging, prod)
forge help deploy staging       # shows help for deploy:staging
```

`forge --list` groups nested commands under their prefix:

```txt
Available commands:

  clean          Remove all node_modules
  deploy
    staging      Deploy to staging
    prod         Deploy to production
  hello          Say hello
```

Nesting is unlimited — `infra:aws:deploy` is invoked as `forge infra aws deploy`. A group prefix (e.g. `deploy`) is not itself runnable unless a `deploy` command also exists in the manifest. Composite commands can reference nested commands by their full colon key: `run: [deploy:staging]`.

To scaffold a nested command:

```bash
forge add deploy:staging --go   # creates .forge/scripts/deploy-staging/deploy-staging.go
```

### Command Builder

Arguments are defined in code using the command builder pattern — no YAML `args` needed. Each script declares its own arguments with type safety, auto-generated `--help`, and introspection via `forge help <cmd>`.

Given a command invoked as:

```bash
forge greet world --shout --count 3
```

The CLI concepts map as follows:

| Concept | What it is | In the example |
| --- | --- | --- |
| **Command** | The top-level verb registered in `forge.yaml`. Forge resolves it and runs the associated script. | `greet` |
| **Arg** | A required positional value — no `--` prefix, identified by position. Must be provided or the script errors. | `world` (1st positional) |
| **Flag** | A boolean switch — presence means `true`, absence means `false`. Never takes a value after it. | `--shout` → `true` |
| **Option** | A named key-value pair. The name is prefixed with `--` and the next token is its value. Supports a default if omitted. | `--count 3` |

**Go:**

```go
package main

import "github.com/arcmantle/forge/helpers"

func main() {
    cmd := helpers.Command("greet", "Greet someone")
    name := cmd.Arg("name", "Name to greet")
    shout := cmd.Flag("shout", "Uppercase the greeting")
    count := cmd.Option("count", "Number of times", "1")
    cmd.Parse()

    helpers.Info("Hello, %s! (x%s, shout=%v)", name.Value, count.Value, shout.Value)
}
```

**TypeScript:**

```typescript
import { command, info } from '#helpers';

const cmd = command('greet', 'Greet someone');
const name = cmd.arg('name', 'Name to greet');
const shout = cmd.flag('shout', 'Uppercase the greeting');
const count = cmd.option('count', 'Number of times', '1');
cmd.parse();

info(`Hello, ${name.value}! (x${count.value}, shout=${shout.value})`);
```

**C#:**

```csharp
using Forge.Helpers;

var cmd = Cmd.Create("greet", "Greet someone");
var name = cmd.Arg("name", "Name to greet");
var shout = cmd.Flag("shout", "Uppercase the greeting");
var count = cmd.Option("count", "Number of times", "1");
cmd.Parse();

Log.Info($"Hello, {name.Value}! (x{count.Value}, shout={shout.Value})");
```

The builder provides three argument types:

| Method | Description | Parsed as |
| --- | --- | --- |
| `Arg(name, desc)` | Required positional argument | `StringValue` |
| `Option(name, desc [, default])` | Named string option (`--name value`) | `StringValue` |
| `Flag(name, desc)` | Boolean flag (`--name`) | `BoolValue` |

`Parse()` handles `--help` / `-h` automatically, printing a formatted help screen and exiting. `forge help <command>` also works — it invokes the script with `--forge-meta` to retrieve argument metadata.

```
$ forge help greet
greet — Greet someone

Usage:
  forge greet <name> [flags]

Args:
  name    Name to greet

Flags:
  --shout           Uppercase the greeting
  --count <value>   Number of times (default: 1)
```

## Multi-Language Scripts

All languages use top-level code — no special interface or wrapper needed.

### Go

```go
package main

import "github.com/arcmantle/forge/helpers"

func main() {
    helpers.Info("Hello from Go!")
    helpers.Exec("echo", []string{"done"}, helpers.RunOpts{})
}
```

Go scripts are compiled to `.forge/cache/` with content-hash caching — only recompiled when the source changes.

### TypeScript

```typescript
import { info, exec } from '#helpers';

info('Hello from TypeScript!');
await exec('echo', ['done']);
```

```txt

TypeScript scripts run natively via `node` (requires Node 23.6+). The `#helpers` import maps to the generated helpers file via `package.json` subpath imports.

### C\#

```csharp
using Forge.Helpers;

Log.Info("Hello from C#!");
await Exec.Run("echo", ["done"]);
return 0;
```

C# scripts are compiled via `dotnet publish` with content-hash caching. Top-level statements — `args` is available as a built-in variable.

## CLI Reference

```bash
forge <command> [args...]    Run a command
forge --list, -l             List available commands
forge --help, -h             Show help
forge --version, -v          Show version
forge init                   Scaffold forge.yaml and .forge/
forge add <name> [--lang]    Add a new script (go, ts, cs)
forge add <name> --from      Create a script from a template
forge templates              List available script templates
forge setup <runtime>        Add scaffolding for a runtime (go, ts, cs)
forge help <command>         Show detailed help for a command
```

### `forge init`

Creates `forge.yaml`, `.forge/` directory with helpers, schema, and project files. Scaffolding is conditional — only sets up runtimes that are installed on your system:

- **Go**: `go.mod`, Go helpers
- **TypeScript**: `package.json`, `tsconfig.json`, TS helpers, installs dependencies
- **C#**: `ForgeScripts.csproj`, `ForgeScripts.slnx`, C# helpers

### `forge add <name>`

Adds a new script with the correct boilerplate. Defaults to Go. If no `forge.yaml` exists in the current directory, forge bootstraps the full setup automatically — creating `forge.yaml`, `.forge/` directory, and language support files so intellisense works immediately.

```bash
forge add deploy            # Go script
forge add deploy --ts       # TypeScript script
forge add deploy --cs       # C# script
```

This makes it easy to set up subdirectory-specific scripts in monorepos:

```bash
cd apps/frontend
forge add dev --ts          # creates forge.yaml, .forge/, and the dev script
forge dev                   # runs the local script
forge install               # still works — inherited from parent forge.yaml
```

### `forge add <name> --from <template>`

Create a script from a reusable template. Templates provide pre-built script scaffolding with variable substitution — a starting point you own and customize.

```bash
forge add install --from monorepo-install
forge add deploy --from docker-compose-deploy --ts
forge add ci --from ci-lint-test --var lint_command="pnpm lint" --var test_command="pnpm test"
forge add release --from release --go --var changelog_file=CHANGES.md
forge add deploy --from deploy-k8s@v1.2.0
```

Templates are resolved from four sources (in order):

1. **Built-in templates** — bundled with forge
2. **Template registries** — configured in `forge.yaml` (see [Template Registries](#template-registries))
3. **Local directories** — `--from ./path/to/template`
4. **Git URLs** — `--from https://github.com/user/repo#path/to/template`

Use `--var key=value` to override template placeholder variables. Defaults are used for any unspecified variables.
For registry templates, append `@<tag>` to pin a specific published version (for example: `deploy-k8s@v1.2.0`).

### `forge templates`

List all available templates (built-in and configured registries) with their descriptions, supported languages, and configurable variables.

```bash
forge templates
```

**Built-in templates:**

| Template | Description |
|---|---|
| `monorepo-install` | Parallel pnpm/npm install across workspace directories |
| `docker-compose-deploy` | Build and deploy via docker-compose |
| `ci-lint-test` | Run lint and test in parallel for CI pipelines |
| `release` | Version bump, changelog, git tag, and publish |
| `db-migrate` | Run database migrations with rollback support |

### Template Registries

A template registry is a directory (local or remote git repo) containing reusable template directories. Configure registries in `forge.yaml`:

```yaml
registries:
  - https://github.com/org/forge-templates
  - ./local-templates
```

Registries inherit through manifest discovery — a parent `forge.yaml` can declare registries that are available to all child projects. Multiple manifests' registries are aggregated with deduplication.

A registry can optionally include a `registry.yaml` index at its root for fast listing:

```yaml
name: "My Templates"
templates:
  - name: deploy-k8s
    description: "Deploy to Kubernetes"
    languages: [go, ts]
    variables:
      - name: namespace
        description: "Kubernetes namespace"
        default: default
```

If no `registry.yaml` exists, forge scans the directory for subdirectories containing `template.yaml` files.

For GitHub registry repos and local Git folders, forge supports a branch-based package model:

- Each branch is treated as a template package name
- `forge templates` lists remote branches as templates
- A local Git folder added in `registries:` behaves the same way (local branches become packages)
- Tags that follow `package/tag` are used to determine the latest package version
- `forge add <name> --from <branch-name>` loads that branch as the template source
- `forge add <name> --from <branch-name>@<tag>` loads a tagged version for that package
- Description is read from `template.yaml` when present, with README summary fallback

By default, only the latest tag is surfaced for each package. In `forge --docs`, selecting a package shows previous versions you can pin with `@tag`.

This allows publishing immutable package versions via tags while keeping branch names as package entry points.

Registry templates appear in `forge templates` output grouped by source, and are searchable in `forge --docs`.

#### Template format

Templates are directories containing a `template.yaml` metadata file and script files in one or more languages:

```
my-template/
  template.yaml
  my-template.go
  my-template.ts
  my-template.cs
```

`template.yaml`:

```yaml
description: "What this template does"
variables:
  - name: var_name
    description: "What this variable controls"
    default: default_value
```

Scripts use `__NAME__` for the command name and `__VAR_XXXX__` (uppercase variable name) for placeholder variables, which get replaced when the template is applied.

### `forge setup <runtime>`

Add support for a runtime to enable intellisense. If the current directory has a `.forge/` directory, support files are created there. Otherwise, targets the closest manifest's project root. Idempotent — safe to run multiple times.

```bash
forge setup ts              # Add TypeScript support
forge setup cs              # Add C# support
forge setup go              # Add Go support
```

### Fuzzy Matching

Forge uses prefix matching for command names. If `deploy-prod` is the only command starting with `dep`, running `forge dep` will match it.

## Helpers API

All three languages provide a consistent API surface for common operations.

### Args

Access raw command-line arguments passed to the script. For structured argument parsing, prefer the [Command Builder](#command-builder) instead.

```go
// Go
args := helpers.Args()
```

```typescript
// TypeScript
import { args } from '#helpers';
const a = args();
```

```csharp
// C# — use Environment.GetCommandLineArgs().Skip(1)
```

### Exec

Run commands with streaming output, optional prefixed tags, and environment variables.

**Go:**

```go
helpers.Exec("pnpm", []string{"install"}, helpers.RunOpts{
    Dir:   "/path/to/workspace",
    Tag:   "frontend",
    Color: helpers.ColorCyan,
    Env:   map[string]string{"NODE_ENV": "production"},
})

output, err := helpers.ExecSimple("git", []string{"rev-parse", "HEAD"}, ".")
```

**TypeScript:**

```typescript
await exec('pnpm', ['install'], {
    dir:   '/path/to/workspace',
    tag:   'frontend',
    color: ColorCyan,
    env:   { NODE_ENV: 'production' },
});

const sha = execSimple('git', ['rev-parse', 'HEAD']);
```

**C#:**

```csharp
await Exec.Run("pnpm", ["install"], new RunOpts {
    Dir   = "/path/to/workspace",
    Tag   = "frontend",
    Color = Colors.Cyan,
    Env   = new() { ["NODE_ENV"] = "production" },
});

var sha = Exec.RunSimple("git", ["rev-parse", "HEAD"]);
```

### Filesystem

```go
// Go
helpers.FileExists("package.json")
helpers.FindDirs(".", "src/*")
helpers.FindFiles(".", "*.go")
helpers.FindDirsContaining(".", "package.json")
```

```typescript
// TypeScript
fileExists('package.json')
findDirs('.', 'src/*')
findFiles('.', '*.go')
findDirsContaining('.', 'package.json')
```

```csharp
// C#
Fs.FileExists("package.json")
Fs.FindDirs(".", "src/*")
Fs.FindFiles(".", "*.go")
Fs.FindDirsContaining(".", "package.json")
```

### Logging

All languages provide `info`, `warn`, `error`, and `success` with colored prefixes.

```go
helpers.Info("Installing %d packages", count)
helpers.Warn("Skipping %s", name)
helpers.Error("Build failed: %v", err)
helpers.Success("Deployed to %s", env)
```

### Colors

A palette of ANSI color constants is available for tagged output:

`ColorReset`, `ColorRed`, `ColorGreen`, `ColorYellow`, `ColorBlue`, `ColorMagenta`, `ColorCyan`, `ColorGray`, `ColorBrightRed`

Plus a `Colors` array for cycling through colors in multi-stream output.

## Documentation Site

Forge can serve an interactive documentation site for your project — generated from your manifest and script metadata:

```bash
forge --docs
```

This opens a browser with a single-page reference showing all commands, their arguments, flags, options, and composite step sequences. The data is gathered by running `--forge-meta` on all script commands in parallel.

Features:

- **Grouped sidebar** — nested commands (`:`) displayed under their group prefix
- **Full argument docs** — positionals, flags, and options with types and defaults
- **Composite step visualization** — sequential and parallel steps with clickable cross-references
- **Template browser** — view all available templates with descriptions, languages, variables, and usage examples
- **Direct template install** — install templates from the docs page without leaving the explorer
- **Target selection** — when multiple forge roots are available, choose which project folder receives the install
- **Search** — filter commands and templates by name or description (`/` to focus)
- **Auto-close** — the server shuts down when you close the browser tab

No external dependencies — the HTML is embedded in the forge binary.

## Manifest Discovery

Forge walks up from the current directory looking for `forge.yaml` files. Commands from child manifests override parent ones, allowing hierarchical command definitions across monorepos.

```bash
repo/
  forge.yaml          # repo-wide commands
  apps/
    frontend/
      forge.yaml      # frontend-specific commands (can override parent)
```

Running `forge build` inside `apps/frontend/` will use the frontend manifest's `build` command if defined, falling back to the repo-wide one.

### Auto-Discovered Scripts

In addition to explicit `forge.yaml` entries, forge auto-discovers scripts from `.forge/scripts/` directories. Any subdirectory in `.forge/scripts/` that contains a script file matching `<name>.{go,ts,cs}` is automatically available as a command — no `forge.yaml` entry required.

```bash
repo/
  forge.yaml              # repo-wide commands
  .forge/scripts/
    install/install.go    # auto-discovered as "install"
  apps/
    frontend/
      .forge/scripts/
        dev/dev.ts        # auto-discovered as "dev" (only from apps/frontend/)
```

Running `forge dev` inside `apps/frontend/` will find the auto-discovered `dev` script. Running `forge install` from anywhere under `repo/` will find the repo-wide `install` script.

**Priority rules:**

1. Explicit `forge.yaml` commands always override auto-discovered scripts at any level
2. Closer directories override further ones (same as manifest discovery)
3. Among auto-discovered scripts, the first matching extension wins (`.go` → `.ts` → `.cs`)

This is useful for monorepos where subdirectories need local scripts without cluttering the root `forge.yaml`.

To add scripts to a subdirectory:

```bash
cd apps/frontend
forge add dev --ts           # bootstraps forge.yaml, .forge/, and the dev script
```

## Compilation & Caching

- **Go**: Compiled to `.forge/cache/<name>` using `go build`. A SHA-256 hash of the source file is stored alongside the binary — recompilation only happens when the hash changes.
- **TypeScript**: Executed directly via `node` with no compilation step. Node's native TypeScript support (23.6+) handles it.
- **C#**: Compiled via `dotnet publish -c Release` to `.forge/cache/cs/<name>/`. Same hash-based caching as Go.

## Building from Source

```bash
cd forge
go run build.go 0.1.0
```

This cross-compiles binaries for Linux, macOS, and Windows (amd64 + arm64) into `dist/` and generates `checksums.txt`.

## License

MIT
