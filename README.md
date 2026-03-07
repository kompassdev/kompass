# opencode-kit

Reusable OpenCode workflows for PR creation, review, ticket planning, and request-driven development.

## What it adds

- tools: `changes_load`, `pr_load`, `ticket_load`, `ticket_create`
- subagents: `reviewer`, `planner`
- commands: `/pr/create`, `/pr/review`, `/pr/fix`, `/ticket/plan`, `/ticket/dev`, `/review`, `/dev`
- bundled skills loaded automatically from `skills/`

## Install from npm

Add the package name to your OpenCode config:

```json
{
  "plugin": ["opencode-kit"]
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
  "plugin": ["file:///Users/danielpolito/Code/opencode-toolkit/index.ts"]
}
```

## Validate

```bash
bun run check
```

## Publish

```bash
npm publish
```

The package is plain Bun-friendly ESM TypeScript, so there is no build step.
