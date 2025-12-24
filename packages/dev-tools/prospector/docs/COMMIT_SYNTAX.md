# Commit Message Syntax for Version Bumping

Prospector can automatically bump versions based on simple keywords in commit messages. This provides fine-grained control over versioning without requiring git tags for every release.

## Supported Patterns

### Major Version Bumps

Use `[major]` to trigger a **major** version bump (e.g., `1.2.3` → `2.0.0`):

**Examples:**

```bash
git commit -m "[major] Complete API redesign"
git commit -m "[major] Remove deprecated endpoints"
git commit -m "Refactor authentication system [major]"
```

### Minor Version Bumps

Use `[minor]` to trigger a **minor** version bump (e.g., `1.2.3` → `1.3.0`):

**Examples:**

```bash
git commit -m "[minor] Add user dashboard"
git commit -m "[minor] Implement dark mode"
git commit -m "Add export to CSV functionality [minor]"
```

### Patch Version Bumps

Use `[patch]` to trigger a **patch** version bump (e.g., `1.2.3` → `1.2.4`):

**Examples:**

```bash
git commit -m "[patch] Update dependencies"
git commit -m "[patch] Fix login timeout issue"
git commit -m "Correct date formatting [patch]"
```

### Explicit Version Setting

Use `[version:x.y.z]` or `[v:x.y.z]` to set an **exact version**:

**Examples:**

```bash
git commit -m "[version:1.5.0] Release version 1.5.0"
git commit -m "[v:2.0.0] Major release"
git commit -m "Prepare for release [version:1.2.3]"
```

**Note:** When an explicit version is set, it takes precedence over any bump indicators. This is useful for:

- Aligning with external version requirements
- Jumping to a specific version number
- Resetting version after major refactoring

### No Explicit Bump

Commits without bump indicators fall back to the default behavior (commit count):

**Examples:**

```bash
git commit -m "Update README"
git commit -m "Refactor internal code"
git commit -m "Add comments"
```

## Priority and Accumulation

### Priority Order

Patterns are evaluated in this priority order:

1. **Explicit version** (highest priority - `[version:x.y.z]`)
2. **Major** (`[major]`)
3. **Minor** (`[minor]`)
4. **Patch** (`[patch]`)

**Examples:**

```bash
# Explicit version takes precedence over everything
git commit -m "[major] [version:3.5.0] Release 3.5.0"  # Results in 3.5.0

# Only the highest bump counts per commit
git commit -m "[major] [minor] Big change"  # Counts as major only
```

### Accumulation

Multiple commits can accumulate bumps:

**Scenario:**

```bash
git tag v1.0.0
git commit -m "[minor] Add feature A"
git commit -m "[minor] Add feature B"
git commit -m "[patch] Fix bug in feature A"
```

**Result:** Version `1.2.1`

- Started at `1.0.0`
- 2 minor bumps → `1.2.0`
- 1 patch bump → `1.2.1`

### Explicit Version Override

When an explicit version is set, it overrides all accumulated bumps:

**Scenario:**

```bash
git tag v1.0.0
git commit -m "[minor] Add feature"     # Would bump to 1.1.0
git commit -m "[version:2.5.0] Align with upstream"  # Sets to 2.5.0
```

**Result:** Version `2.5.0` (explicit version used)

### Version Reset Rules

When bumping major or minor versions, lower components reset to 0:

**Major bump:**

- `1.5.7` + major → `2.0.0` (minor and patch reset)

**Minor bump:**

- `1.5.7` + minor → `1.6.0` (patch resets)

**Patch bump:**

- `1.5.7` + patch → `1.5.8` (no reset)

**Explicit version:**

- `1.5.7` + `[version:3.2.1]` → `3.2.1` (exact version)

## Customizing Patterns

You can customize the patterns programmatically:

```typescript
import { calculateVersion } from '@arcmantle/prospector';

const version = calculateVersion({
  commitBumpPatterns: {
    // Custom pattern: exclamation mark for breaking changes
    major: /!:|BREAKING/i,

    // Custom pattern: plus sign for features
    minor: /\+:|feature/i,

    // Custom pattern: dash for fixes
    patch: /-:|fix|hotfix/i
  }
});
```

## Disabling Commit Message Bumping

You can disable this feature entirely:

**CLI:**

```bash
prospector --no-commit-bumps
```

**Programmatically:**

```typescript
const version = calculateVersion({
  enableCommitBumps: false
});
```

When disabled, Prospector falls back to the original behavior: each commit increments the patch version by 1.

## Best Practices

### 1. Use Conventional Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/) for consistency:

```bash
feat: add new feature      # Minor bump
fix: resolve bug           # Patch bump
feat!: breaking change     # Major bump (using !)
```

### 2. Be Explicit for Important Changes

Use explicit markers for clarity:

```bash
git commit -m "[major] Migrate to new database schema"
git commit -m "[minor] Add experimental AI features"
```

### 3. Combine with Tags for Releases

Use commit messages for automatic versioning, then create tags for official releases:

```bash
# Development happens with automatic bumps
git commit -m "feat: add feature X"
git commit -m "fix: resolve issue Y"

# Check the calculated version
prospector
# Output: 1.3.2

# Create official release tag
git tag v1.3.2
git push --tags
```

### 4. Consistency in Your Team

Document which patterns your team will use and stick to them:

```markdown
Our Commit Convention:
- Use `feat:` for new features
- Use `fix:` for bug fixes
- Use `BREAKING CHANGE:` for breaking changes
- Use `chore:` for non-functional changes
```

## Example Workflow

```bash
# Starting point
git tag v1.0.0

# Add features
git commit -m "feat: user profile page"
git commit -m "feat: password reset flow"

# Fix a bug
git commit -m "fix: email validation"

# Check version
prospector
# Output: 1.2.1
# (started at 1.0.0, +2 minor, +1 patch)

# Breaking change
git commit -m "BREAKING CHANGE: new API endpoints"

prospector
# Output: 2.0.0
# (major bump resets minor and patch)

# Create release
git tag v2.0.0
git push --tags
```

## Integration with CI/CD

See [EXAMPLES.md](./EXAMPLES.md) for CI/CD integration examples using commit message bumping.
