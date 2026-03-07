> **Status**: Under active development. APIs and commands may change.

<p align="center">
  <img src="assets/opencode-compass.png" alt="OpenCode Compass mascot" width="420" />
</p>

# opencode-compass

Navigate your codebase with confidence. A plugin that keeps your AI agents on course—from planning to PR.

## What it adds

- tools: `changes_load`, `pr_load`, `ticket_load`, `ticket_create`
- subagents: `reviewer`, `planner`
- commands: `/pr/create`, `/pr/review`, `/pr/fix`, `/ticket/plan`, `/ticket/dev`, `/review`, `/dev`
- bundled skills loaded automatically from `skills/`

## Install from npm

Add the package to your OpenCode config:

```json
{
  "plugin": ["opencode-compass"]
}
```

## Structure

```text
agents/    subagent prompts
commands/  command templates
lib/       shared loaders and path helpers
tools/     one file per tool
skills/    reusable workflow guidance
index.ts   plugin entrypoint
```

## Test locally before publishing

Point OpenCode at the local entry file:

```json
{
  "plugin": ["file:///Users/danielpolito/Code/opencode-compass/index.ts"]
}
```

## Validate

```bash
bun run check
```

## Publish

```bash
npm publish --access public
```

The package is plain Bun-friendly ESM TypeScript, so there is no build step.
