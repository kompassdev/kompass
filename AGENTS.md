# AGENTS.md - opencode-compass

Guidelines for AI agents working in this repository.

## What This Is

This is a Compass workspace with multiple packages.

- `packages/core` contains the generic workflow toolkit
- `packages/opencode` contains the OpenCode adapter

Compiled OpenCode artifacts are still written to `.opencode.compiled/` at the workspace root for review.

## When Making Changes

```bash
# Always run after changes
bun run compile
bun run typecheck
bun run test
```

Never edit `.opencode.compiled/` directly.

## Project Structure

```text
packages/core/      # Shared commands, agents, components, tools, tests
packages/opencode/  # OpenCode adapter package
.compass/           # Local workspace config used for development
.opencode.compiled/ # Generated OpenCode output for review
```

## Package Boundaries

- Put reusable workflow logic in `packages/core`
- Put OpenCode-specific SDK wiring in `packages/opencode`
- Do not make the workspace root a runtime package again

## Testing

```bash
bun run compile
bun run typecheck
bun run test
```

Core tool tests live under `packages/core/test/`. OpenCode adapter tests live under `packages/opencode/test/`.
