# Commit Message Syntax for Version Bumping

Prospector can automatically bump versions based on keywords in commit messages. This provides fine-grained control over versioning without requiring git tags for every release.

## Supported Patterns

### Major Version Bumps

Patterns that trigger a **major** version bump (e.g., `1.2.3` → `2.0.0`):

- `[major]` - Explicit major bump marker
- `+semver: major` - Semantic version annotation
- `BREAKING CHANGE` - Conventional commits breaking change
- `BREAKING-CHANGE` - Alternative format

**Examples:**
```bash
git commit -m "[major] Complete API redesign"
git commit -m "+semver: major - Removed legacy endpoints"
git commit -m "refactor: BREAKING CHANGE: changed authentication flow"
```

### Minor Version Bumps

Patterns that trigger a **minor** version bump (e.g., `1.2.3` → `1.3.0`):

- `[minor]` - Explicit minor bump marker
- `+semver: minor` - Semantic version annotation
- `feat:` - Conventional commits feature
- `feature:` - Alternative feature marker

**Examples:**
```bash
git commit -m "[minor] Add user dashboard"
git commit -m "feat: implement dark mode"
git commit -m "feature: add export to CSV functionality"
git commit -m "+semver: minor - new reporting module"
```

### Patch Version Bumps

Patterns that trigger a **patch** version bump (e.g., `1.2.3` → `1.2.4`):

- `[patch]` - Explicit patch bump marker
- `+semver: patch` - Semantic version annotation
- `fix:` - Conventional commits fix
- `bugfix:` - Alternative fix marker

**Examples:**
```bash
git commit -m "[patch] Update dependencies"
git commit -m "fix: resolve login timeout issue"
git commit -m "bugfix: correct date formatting"
git commit -m "+semver: patch - minor UI tweaks"
```

### No Explicit Bump

Commits without bump indicators fall back to the default behavior (commit count):

**Examples:**
```bash
git commit -m "chore: update README"
git commit -m "docs: improve API documentation"
git commit -m "style: format code"
git commit -m "test: add unit tests"
```

## Priority and Accumulation

### Priority Order

When a commit contains multiple patterns, **only the highest priority** bump is counted:

1. **Major** (highest priority)
2. **Minor**
3. **Patch** (lowest priority)

**Example:**
```bash
# This commit only counts as a major bump, not major + minor
git commit -m "feat: BREAKING CHANGE: new authentication system"
```

### Accumulation

Multiple commits can accumulate bumps:

**Scenario:**
```bash
git tag v1.0.0
git commit -m "feat: add feature A"     # Minor bump
git commit -m "feat: add feature B"     # Minor bump
git commit -m "fix: bug in feature A"   # Patch bump
```

**Result:** Version `1.2.1`
- Started at `1.0.0`
- 2 minor bumps → `1.2.0`
- 1 patch bump → `1.2.1`

### Version Reset Rules

When bumping major or minor versions, lower components reset to 0:

**Major bump:**
- `1.5.7` + major → `2.0.0` (minor and patch reset)

**Minor bump:**
- `1.5.7` + minor → `1.6.0` (patch resets)

**Patch bump:**
- `1.5.7` + patch → `1.5.8` (no reset)

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
