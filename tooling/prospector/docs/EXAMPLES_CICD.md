# Example: Complete CI/CD with Prospector

This example shows a complete CI/CD workflow using Prospector for automatic versioning and releases.

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  # Test on PRs and main
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm test
      - run: pnpm build

  # Calculate version on main branch
  version:
    if: github.ref == 'refs/heads/main'
    needs: test
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.version.outputs.version }}
      is-release: ${{ steps.check.outputs.is-release }}

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Calculate Version
        id: version
        uses: arcmantle/prospector@v1

      - name: Check for Release
        id: check
        run: |
          # Check if this version has major or minor bumps
          if [ "${{ steps.version.outputs.major-bumps }}" -gt 0 ] || \
             [ "${{ steps.version.outputs.minor-bumps }}" -gt 0 ]; then
            echo "is-release=true" >> $GITHUB_OUTPUT
          else
            echo "is-release=false" >> $GITHUB_OUTPUT
          fi

  # Create release and publish
  release:
    if: needs.version.outputs.is-release == 'true'
    needs: version
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          registry-url: 'https://registry.npmjs.org'

      - name: Install & Build
        run: |
          pnpm install
          pnpm build

      - name: Update Package Version
        run: |
          npm version ${{ needs.version.outputs.version }} --no-git-tag-version

      - name: Create Git Tag
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git tag v${{ needs.version.outputs.version }}
          git push origin v${{ needs.version.outputs.version }}

      - name: Create GitHub Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: v${{ needs.version.outputs.version }}
          release_name: Release v${{ needs.version.outputs.version }}
          draft: false
          prerelease: false

      - name: Publish to npm
        run: pnpm publish --no-git-checks --provenance
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Key Features of This Workflow

### 1. **Automatic Testing**

- Runs on all PRs and main branch pushes
- Ensures code quality before versioning

### 2. **Smart Versioning**

- Calculates version based on git history
- Only creates releases for major/minor bumps
- Patch bumps don't trigger releases (optional behavior)

### 3. **Automated Releases**

- Creates git tags automatically
- Publishes to npm with provenance
- Creates GitHub releases

### 4. **Efficient**

- Tests run on all branches
- Versioning only on main
- Releases only when needed

## Customization Options

### Always Release (Every Push)

Remove the conditional release check:

```yaml
release:
  if: github.ref == 'refs/heads/main'  # Always release on main
  needs: version
  # ... rest of job
```

### Manual Release Approval

Add a manual approval step:

```yaml
release:
  needs: version
  runs-on: ubuntu-latest
  environment: production  # Requires approval in GitHub settings
  # ... rest of job
```

### Pre-release for Feature Branches

```yaml
prerelease:
  if: github.ref != 'refs/heads/main'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - name: Calculate Pre-release Version
      id: version
      uses: arcmantle/prospector@v1

    - name: Publish Pre-release
      run: |
        npm version ${{ steps.version.outputs.version }} --no-git-tag-version
        npm publish --tag next
      env:
        NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Monorepo Support

```yaml
version-packages:
  runs-on: ubuntu-latest
  strategy:
    matrix:
      package:
        - packages/core
        - packages/utils
        - packages/cli

  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - name: Version ${{ matrix.package }}
      id: version
      uses: arcmantle/prospector@v1
      with:
        dir: ${{ matrix.package }}

    - name: Save version
      run: |
        echo "${{ steps.version.outputs.version }}" > ${{ matrix.package }}/VERSION
```

## Alternative: Simpler Workflow

For smaller projects, a simpler approach:

```yaml
name: Release

on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Get Version
        id: version
        uses: arcmantle/prospector@v1

      - name: Check if Tagged
        id: check
        run: |
          if git rev-parse "v${{ steps.version.outputs.version }}" >/dev/null 2>&1; then
            echo "exists=true" >> $GITHUB_OUTPUT
          else
            echo "exists=false" >> $GITHUB_OUTPUT
          fi

      - name: Create Tag & Release
        if: steps.check.outputs.exists == 'false'
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git tag v${{ steps.version.outputs.version }}
          git push origin v${{ steps.version.outputs.version }}
```

This approach:

- ✅ No manual version bumping
- ✅ No package.json modifications
- ✅ Tags created automatically
- ✅ Works with existing tools
