# Example Usage Scripts

## Update package.json version

This script shows how to use Prospector to automatically update your package.json version:

```typescript
// scripts/update-version.ts
import { calculateVersion } from '@arcmantle/prospector';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const packageJsonPath = resolve(process.cwd(), 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

const versionInfo = calculateVersion();
packageJson.version = versionInfo.version;

writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`Updated version to ${versionInfo.version}`);
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Version and Release

on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  version:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Important: fetch all history for version calculation

      - uses: pnpm/action-setup@v2

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Calculate version
        id: version
        run: |
          VERSION=$(pnpm prospector)
          echo "version=$VERSION" >> $GITHUB_OUTPUT
          echo "Calculated version: $VERSION"

      - name: Update package.json
        run: |
          node -e "
            const fs = require('fs');
            const pkg = JSON.parse(fs.readFileSync('package.json'));
            pkg.version = '${{ steps.version.outputs.version }}';
            fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
          "

      - name: Build
        run: pnpm build

      - name: Publish (if on main and not prerelease)
        if: github.ref == 'refs/heads/main'
        run: |
          if [[ ! "${{ steps.version.outputs.version }}" =~ "-" ]]; then
            pnpm publish --no-git-checks
          fi
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### GitLab CI

```yaml
# .gitlab-ci.yml
version:
  stage: build
  script:
    - pnpm install
    - VERSION=$(pnpm prospector)
    - echo "VERSION=$VERSION" >> version.env
    - echo "Calculated version is $VERSION"
  artifacts:
    reports:
      dotenv: version.env

build:
  stage: build
  needs: [version]
  script:
    - pnpm install
    - |
      node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('package.json'));
        pkg.version = process.env.VERSION;
        fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
      "
    - pnpm build
```

## Pre-commit Hook

Automatically update version before each commit on main:

```bash
# .git/hooks/pre-commit
#!/bin/bash

BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ "$BRANCH" = "main" ]; then
  VERSION=$(pnpm prospector)

  # Update package.json
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json'));
    if (pkg.version !== '$VERSION') {
      pkg.version = '$VERSION';
      fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
      console.log('Updated package.json version to $VERSION');
    }
  "

  # Add updated package.json to commit
  git add package.json
fi
```

## NPM Scripts

Add to your package.json:

```json
{
  "scripts": {
    "version": "prospector",
    "version:bump": "prospector --suggest minor",
    "version:update": "node -e \"const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('package.json')); const { execSync } = require('child_process'); const version = execSync('pnpm prospector', { encoding: 'utf-8' }).trim(); pkg.version = version; fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\\n'); console.log('Updated to', version);\"",
    "prebuild": "pnpm version:update"
  }
}
```

## Manual Tagging Workflow

```bash
# Check current version
pnpm prospector

# When ready for a minor release
NEXT_VERSION=$(pnpm prospector --suggest minor)
echo "Next minor version would be: $NEXT_VERSION"

# Create and push tag
git tag "v$NEXT_VERSION"
git push origin "v$NEXT_VERSION"

# For major releases
NEXT_MAJOR=$(pnpm prospector --suggest major)
git tag "v$NEXT_MAJOR"
git push origin "v$NEXT_MAJOR"
```

## Automated Release Script

```typescript
// scripts/release.ts
import { calculateVersion, suggestVersionBump } from '@arcmantle/prospector';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const bumpType = args[0] as 'major' | 'minor' | 'patch';

if (!['major', 'minor', 'patch'].includes(bumpType)) {
  console.error('Usage: pnpm release <major|minor|patch>');
  process.exit(1);
}

// Calculate suggested version
const nextVersion = suggestVersionBump(bumpType);

console.log(`Creating ${bumpType} release: ${nextVersion}`);

// Confirm
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout,
});

readline.question(`Create tag v${nextVersion}? (y/N) `, (answer: string) => {
  readline.close();

  if (answer.toLowerCase() === 'y') {
    execSync(`git tag v${nextVersion}`, { stdio: 'inherit' });
    execSync(`git push origin v${nextVersion}`, { stdio: 'inherit' });
    console.log(`✓ Released version ${nextVersion}`);
  } else {
    console.log('Cancelled');
  }
});
```
