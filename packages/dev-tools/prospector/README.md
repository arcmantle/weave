# Prospector

A TypeScript/Node.js tool for calculating semantic versions (semver) based on git commit history using a trunk-based development workflow.

## Features

- **Commit Message Version Bumping**: Automatically bump major/minor/patch based on commit message keywords (e.g., `feat:`, `fix:`, `BREAKING CHANGE`)
- **Trunk-Based Versioning**: Each commit to the main branch increments the version intelligently
- **Prerelease Versioning**: Feature branches use prerelease version format (e.g., `1.2.3-feature.5`)
- **Tag-Based Version Control**: Use git tags to set explicit versions
- **Conventional Commits Support**: Built-in support for conventional commit syntax
- **Flexible Configuration**: Customize branch names, tag prefixes, and commit patterns
- **CLI & Programmatic API**: Use as a command-line tool or import as a library

## Installation

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build
```

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
```

### CLI Options

- `-h, --help` - Show help message
- `-d, --dir <path>` - Git repository path (default: current directory)
- `-b, --branch <name>` - Main branch name (default: `main`)
- `-p, --prefix <prefix>` - Version tag prefix (default: `v`)
- `--json` - Output as JSON
- `--detailed` - Output detailed information
- `--suggest <type>` - Suggest next version (`major`, `minor`, or `patch`)
- `--no-commit-bumps` - Disable commit message based version bumping

### Programmatic API

```typescript
import { calculateVersion, suggestVersionBump } from '@arcmantle/prospector';

// Calculate current version
const info = calculateVersion({
  cwd: '/path/to/repo',
  mainBranch: 'main',
  tagPrefix: 'v'
});

console.log(info.version); // e.g., "1.2.5" or "1.2.3-feature.2"
console.log(info.commitBumps); // { major: 0, minor: 2, patch: 1 }

// Disable commit message bumping
const infoNoBumps = calculateVersion({
  enableCommitBumps: false
});

// Custom commit patterns
const infoCustom = calculateVersion({
  commitBumpPatterns: {
    major: /BREAKING|!:/i,
    minor: /feature:|feat:/i,
    patch: /fix:|bugfix:/i
  }
});

// Suggest next version
const nextMinor = suggestVersionBump('minor', {
  cwd: '/path/to/repo'
});

console.log(nextMinor); // e.g., "1.3.0"
```

## Versioning Rules

### Main Branch (Trunk)

When on the main branch, there are two modes of operation:

#### Commit Message-Based Bumping (Default)

When enabled (default), Prospector scans commit messages for version bump indicators:

**Supported Patterns:**
- **Major**: `[major]`, `+semver: major`, `BREAKING CHANGE`
- **Minor**: `[minor]`, `+semver: minor`, `feat:`, `feature:`
- **Patch**: `[patch]`, `+semver: patch`, `fix:`, `bugfix:`

**Examples:**
```bash
git commit -m "feat: add new user dashboard"        # Bumps minor
git commit -m "[major] Complete API redesign"       # Bumps major
git commit -m "fix: resolve login timeout issue"    # Bumps patch
git commit -m "chore: update dependencies"          # No explicit bump
```

**Behavior:**
- If commits contain `[major]` or `feat:` → version bumps accordingly
- Multiple bumps are accumulated (e.g., 3 minor bumps = +3 to minor version)
- When major bumps, minor and patch reset to 0
- When minor bumps, patch resets to 0
- If no explicit bumps found, falls back to commit count

#### Commit Count Mode

When commit message bumping is disabled (`--no-commit-bumps`):

1. Find the most recent version tag (e.g., `v1.2.0`)
2. Count commits since that tag
3. Add commit count to the patch version
4. Example: If tag is `v1.2.0` and there are 5 commits → version is `1.2.5`

### Feature Branches

When on a feature branch:

1. Find the most recent version tag
2. Increment the patch version by 1
3. Add branch name and commit count as prerelease identifier
4. Example: If tag is `v1.2.0`, branch is `feature/awesome`, with 3 commits → version is `1.2.1-feature-awesome.3`

### No Tags

If no version tags exist:

- **Main branch**: Version starts at `0.0.{commitCount}`
- **Feature branch**: Version is `0.0.1-{branch}.{commitCount}`

### Creating Version Tags

To bump major or minor versions, create a git tag:

```bash
# Bump to next major version (e.g., 1.0.0 → 2.0.0)
git tag v2.0.0
git push --tags

# Bump to next minor version (e.g., 1.2.0 → 1.3.0)
git tag v1.3.0
git push --tags
```

After creating a tag, subsequent commits will increment from that version.

## Example Workflow

```bash
# Initial state: no tags, 10 commits on main
prospector
# Output: 0.0.10

# Create first release
git tag v1.0.0
git push --tags

# Make 3 more commits on main
prospector
# Output: 1.0.3

# Create feature branch
git checkout -b feature/new-thing

# Make 2 commits on feature branch
prospector
# Output: 1.0.1-feature-new-thing.2

# Merge back to main (1 merge commit)
git checkout main
git merge feature/new-thing
prospector
# Output: 1.0.4

# Ready for minor release
prospector --suggest minor
# Output: 1.1.0

git tag v1.1.0
git push --tags
```

## API Reference

### `calculateVersion(options?)`

Calculates the current version based on git history.

**Parameters:**

- `options.cwd` - Repository path (default: `'.'`)
- `options.mainBranch` - Main branch name (default: `'main'`)
- `options.tagPrefix` - Tag prefix (default: `'v'`)

**Returns:** `VersionInfo` object with:

- `version` - The calculated version string
- `branch` - Current branch name
- `isMainBranch` - Whether on main branch
- `commitsSinceTag` - Number of commits since last tag
- `lastTag` - Last version tag info (or null)
- `currentCommit` - Current commit hash
- `commitBumps` - Object with `{ major, minor, patch }` counts from commit messages

### `suggestVersionBump(bumpType, options?)`

Suggests the next version for a given bump type.

**Parameters:**

- `bumpType` - `'major'`, `'minor'`, or `'patch'`
- `options` - Same as `calculateVersion`

**Returns:** Version string (e.g., `'2.0.0'`)

## Quick Reference

### Commit Message Syntax

```bash
# Major version bump (1.0.0 → 2.0.0)
git commit -m "[major] Breaking API changes"
git commit -m "BREAKING CHANGE: removed old endpoints"

# Minor version bump (1.0.0 → 1.1.0)
git commit -m "feat: add user dashboard"
git commit -m "[minor] New reporting feature"

# Patch version bump (1.0.0 → 1.0.1)
git commit -m "fix: resolve login issue"
git commit -m "[patch] Update dependencies"

# No explicit bump (falls back to commit count)
git commit -m "chore: update README"
```

See [COMMIT_SYNTAX.md](./COMMIT_SYNTAX.md) for comprehensive documentation on commit message patterns.

### Common Commands

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
