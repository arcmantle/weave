# yeetm

Recursively find and remove files and directories by name. Fast, safe, satisfying.

Defaults to removing `node_modules` — pass glob patterns to target anything.

## Install

No runtime needed — prebuilt binaries are included for all platforms.

```sh
# Run directly (no install)
npx yeetm
pnpx yeetm

# Or install globally
npm i -g yeetm

# Or via Go
go install github.com/arcmantle/weave/tooling/yeetm@latest
```

### macOS install note

On macOS, `yeetm` runs a best-effort `postinstall` step on the installed Darwin binary:

```sh
chmod +x <path-to-yeetm-binary>
xattr -dr com.apple.quarantine <path-to-yeetm-binary>
```

If execution still fails, run those commands manually in that order.

## Usage

```sh
yeetm                                 # Yeet all node_modules from cwd
yeetm dist                             # Remove all dist directories
yeetm node_modules dist                # Remove both node_modules and dist
yeetm "*.log"                          # Remove all .log files
yeetm ".DS_Store"                      # Remove .DS_Store files
yeetm node_modules "*.log"             # Mix directories and files
yeetm -C ./projects                    # Target a specific directory
yeetm --dry-run --verbose              # Preview with sizes
yeetm -y -e vendor                     # Skip prompt, ignore vendor/
yeetm -e .cache -e build               # Exclude multiple directories
```

## Options

| Flag | Short | Description |
| --- | --- | --- |
| `--dir <path>` | `-C` | Target directory to scan (defaults to cwd) |
| `--yes` | `-y` | Skip confirmation prompt |
| `--dry-run` | `-d` | List what would be removed without deleting |
| `--verbose` | `-v` | Show size of each match |
| `--debug` | `-D` | Show scan and removal errors |
| `--jobs <n>` | `-j` | Number of concurrent workers (default: number of CPUs) |
| `--exclude <dir>` | `-e` | Exclude directories from scanning (repeatable) |
| `--help` | `-h` | Show help message |
| `--version` | | Show version number |

## How it works

1. Recursively scans the target directory for files and folders matching the given patterns
2. Defaults to `node_modules` when no patterns are specified
3. Supports glob patterns (`*`, `?`, `[...]`) via Go's `filepath.Match`
4. Skips `.git` directories by default (and anything passed via `--exclude`)
5. Does **not** recurse into matched directories — each one is treated as a single unit
6. Never follows symlinked/reparse-point directories while scanning, sizing, or deleting
7. Shows what it found and asks for confirmation (unless `--yes`)
8. Deletes all found matches in parallel using goroutines

## License

MIT
