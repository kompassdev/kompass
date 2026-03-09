# Compass Workspace

This repository is now a multi-package workspace.

- `packages/core`: shared Compass workflows, prompts, components, config loading, and handcrafted tool definitions
- `packages/opencode`: OpenCode adapter package, publishable as `@kompassdev/opencode`

The root is no longer a publishable package. It exists to coordinate workspace scripts, shared config, tests, and compiled review output.

## Workspace Scripts

```bash
bun run compile
bun run typecheck
bun run test
```

`bun run compile` regenerates `.opencode.compiled/` from the OpenCode package.

## Config

Project config still lives at the repo or consumer project root:

- `.compass/config.json`
- `compass.json`

Legacy OpenCode-specific config paths remain supported:

- `.opencode/compass.json`
- `opencode-compass.json`

## Publishing Direction

- publish `packages/opencode` as `@kompassdev/opencode`
- keep shared workflow logic in `packages/core`
- add future adapters as sibling packages, such as `packages/claude-code`
