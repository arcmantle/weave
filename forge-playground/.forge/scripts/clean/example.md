# Basic Usage

Remove all `node_modules` directories recursively from the workspace:

```bash
forge clean
```

## Dry Run

Preview what would be removed without actually deleting anything:

```bash
forge clean --dryrun
```

This will list all `node_modules` directories found, along with their sizes,
but **will not delete** them.
