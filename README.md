<p align="center">
  <img src="assets/opencode-compass.png" alt="OpenCode Compass mascot" width="420" />
</p>

> **Status**: Under active development. APIs and commands may change.

# opencode-compass

Navigate your codebase with confidence. A plugin that keeps your AI agents on course—from planning to PR.

## What it adds

- tools: `changes_load`, `pr_load`, `ticket_load`, `ticket_create`
- subagents: `reviewer`, `planner`
- commands: `/pr/create`, `/pr/review`, `/pr/fix`, `/ticket/plan`, `/ticket/dev`, `/review`, `/dev`
- embeddable navigation components for consistent guidance

## Review Workflow

- `/pr/review` starts with paginated, normalized `pr_load` metadata, then uses `changes_load` for the actual git-based file diffs, and publishes via `gh api`
- `/review` starts with `changes_load`, expands only the files that matter, and summarizes findings in chat

## Debug Scripts

- `./scripts/changes-load.ts --diff`
- `./scripts/changes-load.ts --base origin/main --head HEAD --diff`
- `./scripts/pr-load.ts --reviews --comments`

## Install from npm

Add the package to your OpenCode config:

```json
{
  "plugin": ["opencode-compass"]
}
```

## Structure

```text
agents/          subagent prompts
commands/        command templates with embedded guidance
components/      reusable navigation guidance
lib/             shared loaders and path helpers
tools/           one file per tool
config.example.json  example configuration file
index.ts         plugin entrypoint
```

## Configuration

Create a configuration file at `.opencode/compass.json` or `opencode-compass.json` in your project root to customize behavior:

```json
{
  "commands": {
    "enabled": ["pr/create", "pr/review", "pr/fix", "ticket/plan", "ticket/dev", "review", "dev"],
    "templates": {
      "pr/create": "custom/path/to/pr-create.txt"
    }
  },
  "agents": {
    "enabled": ["reviewer", "planner"],
    "reviewer": {
      "description": "Custom reviewer description",
      "promptPath": "custom/path/to/reviewer.txt",
      "permission": {
        "edit": "deny"
      }
    }
  },
  "tools": {
    "enabled": ["changes_load", "pr_load", "ticket_load", "ticket_create"]
  },
  "components": {
    "enabled": ["pr-author", "dev-flow", "ticket-plan", "pr-fix", "pr-review"],
    "paths": {
      "pr-author": "custom/path/to/pr-author.txt"
    }
  },
  "defaults": {
    "baseBranch": "main",
    "agentMode": "subagent"
  }
}
```

See `config.example.json` for all available options.

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
