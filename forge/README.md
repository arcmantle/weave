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
forge setup <runtime>        Add scaffolding for a runtime (go, ts, cs)
forge help <command>         Show detailed help for a command
```

### `forge init`

Creates `forge.yaml`, `.forge/` directory with helpers, schema, and project files. Scaffolding is conditional — only sets up runtimes that are installed on your system:

- **Go**: `go.mod`, Go helpers
- **TypeScript**: `package.json`, `tsconfig.json`, TS helpers, installs dependencies
- **C#**: `ForgeScripts.csproj`, `ForgeScripts.slnx`, C# helpers

### `forge add <name>`

Adds a new script with the correct boilerplate. Defaults to Go.

```bash
forge add deploy            # Go script
forge add deploy --ts       # TypeScript script
forge add deploy --cs       # C# script
```

### `forge setup <runtime>`

Add support for a runtime after initial setup. Idempotent — safe to run multiple times.

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
