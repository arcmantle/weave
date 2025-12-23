# Changelog

All notable changes to Prospector will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project uses automated semantic versioning based on git commits.

## [Unreleased]

### Added

- Initial release of Prospector
- Trunk-based versioning support
- Prerelease versioning for feature branches
- Tag-based major/minor version control
- CLI tool with multiple output formats
- Programmatic API
- Comprehensive test suite

## [1.0.0] - 2025-12-23

### Added

- Initial stable release
- `calculateVersion()` function for determining current version
- `suggestVersionBump()` function for version increment suggestions
- CLI with support for:
  - JSON output (`--json`)
  - Detailed output (`--detailed`)
  - Version bump suggestions (`--suggest`)
  - Custom repository path (`--dir`)
  - Custom branch name (`--branch`)
  - Custom tag prefix (`--prefix`)

### Documentation

- Comprehensive README with usage examples
- Example scripts for CI/CD integration
- API documentation
- Workflow examples

---

## Versioning Strategy

This project uses **Prospector** itself for versioning! Here's how it works:

### Main Branch

- Each commit to `main` increments the patch version by 1
- Example: `v1.2.0` → 3 commits → `1.2.3`

### Feature Branches

- Use prerelease versioning
- Format: `{nextPatch}-{branchName}.{commitsSinceTag}`
- Example: On branch `feature/awesome` with 2 commits after `v1.2.0` → `1.2.1-feature-awesome.2`

### Major/Minor Releases

- Created using git tags
- `git tag v2.0.0` - for major releases
- `git tag v1.3.0` - for minor releases

### Release Process

1. Ensure all changes are merged to `main`
2. Run `pnpm prospector --suggest minor` (or `major`)
3. Create tag: `git tag v{version}`
4. Push tag: `git push --tags`
5. CI/CD will handle the rest!
