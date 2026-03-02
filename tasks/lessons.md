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
