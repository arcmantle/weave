# Lessons

## Don't invent flags when the tool should just work

**Date**: 2025-02-25
**Context**: Added a `--local` flag to `forge add` for creating scripts in subdirectories.
**Mistake**: Instead of making `forge add` smart enough to bootstrap a full setup when no forge.yaml exists in CWD, I added a separate `--local` flag with different behavior and required a separate `forge setup` call for intellisense.
**Rule**: When a tool can detect the right thing to do from context (e.g. "no forge.yaml here, I should create one"), it should just do it. Don't add flags that force the user to understand internal distinctions. The command should do the complete job — create the manifest, the .forge/ directory, language support files, and the script — all in one step.

## When content is published, wire it through every layer

**Date**: 2026-03-02
**Context**: User expected template `example.md` to survive publish and appear in registry template details.
**Mistake**: Assuming discovery/listing support was enough without verifying the full path from publish output → registry metadata loaders → docs API payload → UI rendering.
**Rule**: For any new template content, verify and implement end-to-end propagation across publish, loading/indexing, API models, and frontend rendering before considering the feature complete.

## Scope test runs to the target project

**Date**: 2026-03-03
**Context**: Running tests from this monorepo can fan out across many unrelated projects.
**Mistake**: Running broad test execution instead of restricting validation to the active Forge docs project.
**Rule**: When validating changes in Forge docs, run only project-scoped checks/tests from `forge/internal/docs` (or explicitly targeted files in that project). Never run full workspace test suites unless explicitly requested.

## Preserve intentional event semantics in UI flows

**Date**: 2026-03-04
**Context**: Ingredient editor bindings in Food Guru intentionally used `change` events.
**Mistake**: Switching to `input` events as a first response to a save regression without first proving the failure path and honoring the established interaction design.
**Rule**: When behavior appears broken, first write/review tests for the exact user flow and endpoint contract, then fix within existing semantics unless explicitly asked to change them.
