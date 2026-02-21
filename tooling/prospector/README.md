# Prospector

**Semantic versioning made simple.** Calculate versions automatically from your git history using trunk-based development.

## What is Prospector?

Prospector is a tool that generates semantic versions (semver) for your project based on git commits. Instead of manually updating version numbers, Prospector reads your git history and commit messages to calculate the current version automatically.

**Perfect for:**

- Trunk-based development workflows
- Automated CI/CD pipelines
- Projects that want automatic versioning without manual intervention
- Teams that need consistent versioning across repositories

## Quick Start

```bash
# Install
pnpm add -D @arcmantle/prospector

# Get current version
prospector
# Output: 1.2.5

# See what's next
prospector --suggest minor
# Output: 1.3.0
```

## Using in GitHub Actions

The primary way to use Prospector is in CI/CD pipelines. Add it to your workflow to automatically version your packages:

```yaml
name: Publish Package

on:
  push:
    branches: [main]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Required: fetch all history for version calculation

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          registry-url: https://registry.npmjs.org/

      # Calculate version using Prospector
      - name: Calculate version
        id: version
        uses: arcmantle/prospector@v1
        with:
          dir: '.'  # Optional: defaults to repository root

      # Use the calculated version
      - name: Set package version
        run: |
          echo "Setting version to ${{ steps.version.outputs.version }}"
          npm version ${{ steps.version.outputs.version }} --no-git-tag-version

      - name: Publish to NPM
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### GitHub Action Inputs

| Input | Description | Default |
| ------- | ------------- | --------- |
| `dir` | Repository directory path | `'.'` |
| `branch` | Main branch name(s) | `'main'` (also recognizes `'master'`) |
| `prefix` | Version tag prefix | `'v'` |
| `no-commit-bumps` | Disable commit message bumping | `false` |

### GitHub Action Outputs

| Output | Description |
| -------- | ------------- |
| `version` | The calculated semantic version (e.g., `1.2.5`) |
| `branch` | Current branch name |
| `is-main-branch` | `'true'` if on main branch, `'false'` otherwise |
| `commits-since-tag` | Number of commits since last version tag |

### Example: Conditional Publishing

Only publish on main branch with new commits:

```yaml
- name: Calculate version
  id: version
  uses: arcmantle/prospector@v1

- name: Publish to NPM
  if: steps.version.outputs.is-main-branch == 'true' && steps.version.outputs.commits-since-tag != '0'
  run: npm publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Key Features

- **🚀 Smart Version Calculation**: Automatically determines versions from git history
- **💬 Commit Message Bumps**: Use `[major]`, `[minor]`, `[patch]` in commit messages for explicit version control
- **🏷️ Tag-Based Releases**: Create git tags for official version markers
- **🌿 Branch-Aware**: Different versioning for main branch vs feature branches
- **⚡ Lightning Fast**: Optimized for repositories with millions of commits
- **🔧 Flexible**: CLI tool or programmatic API
- **📦 Zero Config**: Works out of the box with sensible defaults
- **⚙️ GitHub Action**: Use in CI/CD pipelines (see [GitHub Action docs](./docs/GITHUB_ACTION.md))

## How It Works

### Three Simple Rules

1. **On main branch**: Version increments based on commits and tags
2. **On feature branches**: Version gets a prerelease suffix (e.g., `1.2.3-feature.5`)
3. **Git tags set versions**: Create tags like `v1.0.0` to mark releases

### Example

```bash
# Start: No tags, 10 commits on main
prospector → 0.0.10

# Tag a release
git tag v1.0.0

# Make 3 more commits
prospector → 1.0.3

# Create feature branch with 2 commits
git checkout -b feature/awesome
prospector → 1.0.1-feature-awesome.2

# Merge back to main
git checkout main
git merge feature/awesome
prospector → 1.0.4
```

## Installation

```bash
# npm
npm install -D @arcmantle/prospector

# pnpm
pnpm add -D @arcmantle/prospector

# yarn
yarn add -D @arcmantle/prospector
```

Or use as a **GitHub Action** - see [GitHub Action docs](./docs/GITHUB_ACTION.md) for details.

## Usage

### Command Line Interface

```bash
# Get the current version
prospector

# Output as JSON
prospector --json

# Show detailed information
prospector --detailed

# Suggest next version for a release
prospector --suggest minor
prospector --suggest major

# Use custom repository path
prospector --dir /path/to/repo

# Use custom branch name and tag prefix
prospector --branch master --prefix version-

# Default supports both 'main' and 'master' automatically
# No need to specify --branch unless using a different name
```

### CLI Options

- `-h, --help` - Show help message
- `-d, --dir <path>` - Git repository path (default: current directory)
- `-b, --branch <name>` - Main/trunk branch name (default: both `main` and `master` are recognized)
- `-p, --prefix <prefix>` - Version tag prefix (default: `v`)
- `--json` - Output as JSON
- `--detailed` - Output detailed information
- `--suggest <type>` - Suggest next version (`major`, `minor`, or `patch`)
- `--no-commit-bumps` - Disable commit message based version bumping

### Programmatic API

```typescript
import { calculateVersion, suggestVersionBump } from '@arcmantle/prospector';

// Get current version
const info = await calculateVersion({
  cwd: '/path/to/repo',
  tagPrefix: 'v'
});

console.log(info.version);      // "1.2.5"
console.log(info.commitBumps);  // { major: 0, minor: 2, patch: 1, explicitVersion: null }

// Suggest next version
const next = await suggestVersionBump('minor');
console.log(next); // "1.3.0"
```

#### Configuration Options

```typescript
await calculateVersion({
  // Repository path (default: current directory)
  cwd: '/path/to/repo',

  // Main branch names (default: ['main', 'master'])
  mainBranch: 'develop',
  // Or multiple: mainBranch: ['main', 'master', 'trunk'],

  // Tag prefix (default: 'v')
  tagPrefix: 'version-',

  // Enable commit message bumping (default: true)
  enableCommitBumps: true,

  // Custom commit patterns
  commitBumpPatterns: {
    major: /BREAKING|!:/i,
    minor: /feature:|feat:/i,
    patch: /fix:|bugfix:/i
  },

  // Progress callback
  onProgress: (msg) => console.log(msg)
});
```

## Versioning Behavior

### Main Branch (Trunk)

On your main branch, Prospector uses commit messages to determine version bumps:

#### Commit Message Markers

Add these markers to your commit messages for explicit version control:

| Marker            | Effect                             | Example                                                |
|-------------------|------------------------------------|--------------------------------------------------------|
| `[major]`         | Bump major version (2.0.0 → 3.0.0) | `git commit -m "[major] Breaking API changes"`         |
| `[minor]`         | Bump minor version (1.2.0 → 1.3.0) | `git commit -m "[minor] Add new feature"`              |
| `[patch]`         | Bump patch version (1.2.3 → 1.2.4) | `git commit -m "[patch] Fix bug"`                      |
| `[version:x.y.z]` | Set exact version                  | `git commit -m "[version:2.5.0] Release 2.5.0"`        |
| `[v:x.y.z]`       | Set exact version (short)          | `git commit -m "[v:1.0.0] Initial release"`            |

#### How Bumps Work

- Explicit versions (`[version:x.y.z]`) take absolute precedence
- Multiple bump indicators accumulate (e.g., 3 `[minor]` = +3 to minor version)
- When major bumps, minor and patch reset to 0
- When minor bumps, patch resets to 0
- If no explicit bumps found, falls back to commit count

#### Optimized Scanning (Default)

Prospector is **extremely fast** even with millions of commits. It uses git's internal indexes to find only commits with bump markers:

**Why it's fast:**

- Only fetches commits containing `[major]`, `[minor]`, `[patch]`, or `[version:x.y.z]`
- Uses `git log --grep` (built-in git optimization)
- Early stops when explicit version found
- Typical repositories: <1% of commits have markers

**Performance examples:**

- 100K commits, 50 with markers → ~0.2s, ~500KB memory
- 1M commits, 100 with markers → ~0.3s, ~1MB memory
- 10M commits, 200 with markers → ~0.5s, ~2MB memory

**No configuration needed** - it just works fast out of the box!

#### Legacy Scan Limit (Optional)

For edge cases or specific performance requirements, you can enable a scan limit:

```typescript
// Only if you experience performance issues
calculateVersion({ maxCommitScan: 1000 })
```

When `maxCommitScan` is set, Prospector falls back to the legacy scanning mode that fetches all commits up to the limit. This is generally not needed with the optimized approach.

#### Tagging Best Practices

Use git tags to mark official releases:

```bash
# Work with commit markers
git commit -m "[minor] Add feature A"
git commit -m "[patch] Fix bug"
git commit -m "[minor] Add feature B"

# Mark official release
git tag v1.5.0
git push --tags

# Continue development
git commit -m "[patch] Quick fix"
prospector → 1.5.1
```

**Why tag?**

- Tags mark stable release points
- Makes version history clear
- Allows easy rollback to specific versions
- Prevents hundreds of bump markers from accumulating

### Feature Branches

Feature branches automatically get prerelease versions:

**Format:** `{base_version}-{branch_name}.{commit_count}`

**Example:**

```bash
# On main: v1.2.0 exists
git checkout -b feature/awesome-thing

# Make 3 commits
prospector → 1.2.1-feature-awesome-thing.3
```

**How it works:**

1. Find last version tag (`v1.2.0`)
2. Increment patch by 1 (`1.2.1`)
3. Add branch name (sanitized) and commit count as prerelease

This makes it clear the version is:

- Not an official release
- Based on version 1.2.0
- From the "feature-awesome-thing" branch
- 3 commits ahead

### No Tags (Initial State)

When no git tags exist:

- **Main branch:** `0.0.{total_commits}`
  - Example: 15 commits → `0.0.15`
- **Feature branch:** `0.0.1-{branch_name}.{total_commits}`
  - Example: 8 commits on `feature/init` → `0.0.1-feature-init.8`

Create your first tag when ready to release:

```bash
git tag v1.0.0
git push --tags
```

## Advanced Usage

### Disable Commit Bumps (Faster)

For maximum speed, disable commit message scanning:

```bash
# CLI
prospector --no-commit-bumps

# API
await calculateVersion({ enableCommitBumps: false })
```

This uses only commit count, no message parsing. Version is simply `{tag} + {commit_count}`.

### Custom Commit Patterns

Match your team's commit conventions:

```typescript
await calculateVersion({
  commitBumpPatterns: {
    major: /BREAKING CHANGE|!:/i,
    minor: /^feat:/i,
    patch: /^fix:/i
  }
});
```

Now commits like `feat: add dashboard` will bump minor version.

### Legacy Scan Limit

If you experience issues (very rare), you can limit commit scanning:

```typescript
await calculateVersion({
  maxCommitScan: 1000  // Only scan last 1000 commits
})
```

**Note:** This is rarely needed. The default optimized mode handles millions of commits efficiently.

## API Reference

### `calculateVersion(options?)`

Calculates the current version based on git history.

**Parameters:**

- `options.cwd` - Repository path (default: `'.'`)
- `options.mainBranch` - Main/trunk branch name(s). Can be a string or array of strings (default: `['main', 'master']` - both are recognized as trunk branches)
- `options.tagPrefix` - Tag prefix (default: `'v'`)
- `options.enableCommitBumps` - Enable commit message bumping (default: `true`)
- `options.maxCommitScan` - Optional limit on commits to scan. Only set this if you experience performance issues. When undefined (default), uses optimized git grep scanning with no limit.
- `options.commitBumpPatterns` - Custom regex patterns for detecting bumps

**Returns:** `VersionInfo` object with:

- `version` - The calculated version string
- `branch` - Current branch name
- `isMainBranch` - Whether on main branch
- `commitsSinceTag` - Number of commits since last tag
- `lastTag` - Last version tag info (or null)
- `currentCommit` - Current commit hash
- `commitBumps` - Object with `{ major, minor, patch, explicitVersion }` counts from commit messages

### `suggestVersionBump(bumpType, options?)`

Suggests the next version for a given bump type.

**Parameters:**

- `bumpType` - `'major'`, `'minor'`, or `'patch'`
- `options` - Same as `calculateVersion`

**Returns:** Version string (e.g., `'2.0.0'`)

## Performance

Prospector is **extremely fast** even with millions of commits:

### Why It's Fast

- **Optimized git operations**: Uses `git log --grep` to scan only commits with bump markers
- **Typical case**: <1% of commits have version markers, so we only process <1%
- **Early termination**: Stops when explicit version found
- **Smart counting**: Uses `git rev-list --count` (O(1) operation)

### Performance Data

|Repository Size|Commits with Bumps|Time  |Memory|
|---------------|------------------|------|------|
|1K commits     |20                |< 0.1s|< 1MB |
|10K commits    |50                |< 0.2s|< 1MB |
|100K commits   |100               |< 0.3s|< 2MB |
|1M commits     |200               |< 0.5s|< 3MB |
|10M commits    |500               |< 1s  |< 5MB |

**With `--no-commit-bumps`**: All sizes run in < 0.1s.

## Quick Reference

### Commit Marker Syntax

```bash
# Major version bump (1.0.0 → 2.0.0)
git commit -m "[major] Breaking API changes"

# Minor version bump (1.0.0 → 1.1.0)
git commit -m "[minor] New reporting feature"

# Patch version bump (1.0.0 → 1.0.1)
git commit -m "[patch] Fix bug in login"

# Set exact version
git commit -m "[version:2.5.0] Release version 2.5.0"
git commit -m "[v:1.3.7] Align with upstream"

# No explicit bump (uses commit count for patch)
git commit -m "Update README"
```

See [docs/COMMIT_SYNTAX.md](./docs/COMMIT_SYNTAX.md) for more details on commit message patterns.

### Common CLI Commands

```bash
# Get current version
prospector

# Show detailed information including commit bumps
prospector --detailed

# Disable commit message bumping
prospector --no-commit-bumps

# Suggest next minor release
prospector --suggest minor

# Use in different directory
prospector --dir /path/to/repo
```

## License

MIT
