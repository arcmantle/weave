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
| `args` | `array` | Argument definitions with `name`, `description`, `required`, `default` |

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

### Arguments

```yaml
commands:
  greet:
    description: "Greet someone"
    script: .forge/scripts/greet/greet.go
    args:
      - name: who
        description: "Name to greet"
        required: true
      - name: shout
        description: "Uppercase the greeting"
        default: "false"
```

Arguments are passed through to the script's `args`/`Run(args)` parameter.

## Multi-Language Scripts

### Go

```go
package main

import "github.com/arcmantle/forge/helpers"

var Script = helpers.ScriptFunc(func(args []string) error {
    helpers.Info("Hello from Go!")
    return helpers.Exec("echo", []string{"done"}, helpers.RunOpts{})
})
```

Go scripts are compiled to `.forge/cache/` with content-hash caching — only recompiled when the source changes.

### TypeScript

```typescript
import { info, exec, type Script } from '#helpers';

export const script: Script = {
    async run(args: string[]) {
        info('Hello from TypeScript!');
        await exec('echo', ['done']);
    }
};
```

TypeScript scripts run natively via `node` (requires Node 23.6+). The `#helpers` import maps to the generated helpers file via `package.json` subpath imports.

### C\#

```csharp
using Forge.Helpers;

Log.Info("Hello from C#!");
await Exec.Run("echo", ["done"]);
return 0;
```

C# scripts are compiled via `dotnet publish` with content-hash caching. Top-level statements are supported.

## CLI Reference

```bash
forge <command> [args...]    Run a command
forge --list, -l             List available commands
forge --help, -h             Show help
forge --version, -v          Show version
forge init                   Scaffold forge.yaml and .forge/
forge add <name> [--lang]    Add a new script (go, ts, cs)
forge setup <runtime>        Add scaffolding for a runtime (go, ts, cs)
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
