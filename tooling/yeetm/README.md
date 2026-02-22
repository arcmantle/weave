# yeetm

Recursively remove all `node_modules` folders from any directory. Fast, safe, satisfying.

## Install

No runtime needed — prebuilt binaries are included for all platforms.

```sh
# Run directly (no install)
npx yeetm
pnpx yeetm

# Or install globally
npm i -g yeetm

# Or via Go
go install github.com/arcmantle/yeetm@latest
```

## Usage

```sh
yeetm                                 # Yeet all node_modules from cwd
yeetm ./projects                      # Target a specific directory
yeetm --dry-run --verbose              # Preview with sizes
yeetm -y -e vendor                     # Skip prompt, ignore vendor/
yeetm -e dist -e build                 # Exclude multiple directories
```

## Options

| Flag | Short | Description |
| --- | --- | --- |
| `--yes` | `-y` | Skip confirmation prompt |
| `--dry-run` | `-d` | List what would be removed without deleting |
| `--verbose` | `-v` | Show size of each node_modules folder |
| `--exclude <dir>` | `-e` | Exclude directories from scanning (repeatable) |
| `--help` | `-h` | Show help message |
| `--version` | | Show version number |

## How it works

1. Recursively scans the target directory for folders named `node_modules`
2. Skips `.git` directories by default (and anything passed via `--exclude`)
3. Does **not** recurse into `node_modules` — each one is treated as a single unit
4. Shows what it found and asks for confirmation (unless `--yes`)
5. Deletes all found folders in parallel using goroutines

## License

MIT
