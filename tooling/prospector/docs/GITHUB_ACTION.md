# GitHub Action Usage

Prospector can be used as a GitHub Action to automatically calculate versions in your CI/CD pipeline.

## Quick Start

```yaml
name: Calculate Version

on: [push]

jobs:
  version:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Important: Need full git history

      - name: Calculate Version
        id: version
        uses: arcmantle/prospector@v1

      - name: Use Version
        run: echo "Version is ${{ steps.version.outputs.version }}"
```

## Inputs

| Input | Description | Required | Default |
| ------- | ------------- | ---------- | --------- |
| `dir` | Git repository path | No | `.` |
| `branch` | Main branch name(s), comma-separated | No | `main,master` |
| `prefix` | Version tag prefix | No | `v` |
| `suggest` | Suggest next version (`major`, `minor`, or `patch`) | No | - |
| `no-commit-bumps` | Disable commit message based version bumping | No | `false` |

## Outputs

| Output | Description | Example |
| -------- | ------------- | --------- |
| `version` | Calculated semantic version | `1.2.5` |
| `branch` | Current git branch | `main` |
| `is-main-branch` | Whether on main/trunk branch | `true` |
| `commits-since-tag` | Number of commits since last version tag | `5` |
| `last-tag` | Last version tag found | `v1.2.0` |
| `current-commit` | Current commit hash | `abc123...` |
| `major-bumps` | Number of major version bumps from commits | `0` |
| `minor-bumps` | Number of minor version bumps from commits | `2` |
| `patch-bumps` | Number of patch version bumps from commits | `1` |

## Examples

### Calculate Current Version

```yaml
- name: Get Version
  id: version
  uses: arcmantle/prospector@v1

- name: Build with Version
  run: |
    echo "Building version ${{ steps.version.outputs.version }}"
    npm version ${{ steps.version.outputs.version }} --no-git-tag-version
    npm run build
```

### Suggest Next Version for Release

```yaml
- name: Suggest Next Minor Version
  id: next
  uses: arcmantle/prospector@v1
  with:
    suggest: minor

- name: Create Release
  run: |
    echo "Next version: ${{ steps.next.outputs.version }}"
    git tag v${{ steps.next.outputs.version }}
    git push --tags
```

### Custom Configuration

```yaml
- name: Calculate Version
  uses: arcmantle/prospector@v1
  with:
    dir: ./my-project
    branch: develop
    prefix: version-
```

### Disable Commit Message Bumping

```yaml
- name: Calculate Version (Fast Mode)
  uses: arcmantle/prospector@v1
  with:
    no-commit-bumps: true
```

### Automated Tagging on Main

```yaml
name: Auto Tag Releases

on:
  push:
    branches: [main]

jobs:
  tag:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Calculate Version
        id: version
        uses: arcmantle/prospector@v1

      - name: Create Tag
        if: steps.version.outputs.is-main-branch == 'true'
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git tag v${{ steps.version.outputs.version }}
          git push origin v${{ steps.version.outputs.version }}
```

### Conditional Release Based on Bumps

```yaml
- name: Get Version Info
  id: version
  uses: arcmantle/prospector@v1

- name: Create Major Release
  if: steps.version.outputs.major-bumps > 0
  run: echo "Major release detected!"

- name: Create Minor Release
  if: steps.version.outputs.minor-bumps > 0 && steps.version.outputs.major-bumps == 0
  run: echo "Minor release detected!"
```

### Multi-Repository Monorepo

```yaml
- name: Version Package A
  id: pkg-a
  uses: arcmantle/prospector@v1
  with:
    dir: ./packages/a

- name: Version Package B
  id: pkg-b
  uses: arcmantle/prospector@v1
  with:
    dir: ./packages/b
```

## Important Notes

### Fetch Full Git History

The action **requires full git history** to calculate versions correctly. Always use:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0  # This is critical!
```

### Branch Detection

The action automatically detects both `main` and `master` as trunk branches. You can customize this:

```yaml
with:
  branch: 'develop,staging,production'
```

### Performance

Prospector is extremely fast even with millions of commits. The default optimized mode typically completes in < 1 second.

## Troubleshooting

### "No git repository found"

Ensure you've checked out the repository first:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
```

### "Version seems incorrect"

Check the detailed output in the Action summary, which shows:

- Current branch
- Last tag found
- Commits since tag
- Commit bumps detected

### Need Help?

See the [main README](./README.md) for more details on versioning rules and commit message syntax.
