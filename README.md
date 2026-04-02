> Kompass is under active development, so workflows, package APIs, and adapter support may keep evolving as the toolkit expands.

<p align="center">
  <img src="https://raw.githubusercontent.com/kompassdev/kompass/main/assets/kompass.png" alt="Kompass" height="300" />
  <br>
  <em>Navigate your way - manual steering, steered autonomy, or autonomously.</em>
</p>

Kompass keeps AI coding agents on course with token-efficient, composable workflows.

It provides commands, agents, tools, and reusable prompt components for planning, development, review, and shipping.

## Docs

- Docs home: https://kompassdev.ai/docs/
- Getting started: https://kompassdev.ai/docs/getting-started/
- OpenCode adapter: https://kompassdev.ai/docs/adapters/opencode/
- Config reference: https://kompassdev.ai/docs/config/overview/
- Command reference: https://kompassdev.ai/docs/reference/commands/
- Agent reference: https://kompassdev.ai/docs/reference/agents/
- Tool reference: https://kompassdev.ai/docs/reference/tools/
- Component reference: https://kompassdev.ai/docs/reference/components/

## What Ships Today

- Commands for direct work, orchestration, tickets, PRs, review, and shipping.
- Narrow agents with clear roles: `worker`, `planner`, `navigator`, and `reviewer`.
- Structured tools for repo and GitHub state: `changes_load`, `command_expansion`, `pr_load`, `pr_sync`, `ticket_load`, and `ticket_sync`.
- Reusable command-template components in `packages/core/components/`.

## Installation

OpenCode is the current adapter. Add the plugin to your config:

```json
{
  "plugin": ["@kompassdev/opencode"]
}
```

Project config is optional. To start from the published base config:

```bash
curl -fsSL https://raw.githubusercontent.com/kompassdev/kompass/main/kompass.jsonc -o .opencode/kompass.jsonc
```

Kompass loads the bundled base config, then optional home-directory overrides, then optional project overrides. In each location it uses the first file that exists from:

- `.opencode/kompass.jsonc`
- `.opencode/kompass.json`
- `kompass.jsonc`
- `kompass.json`

The recommended project override path is `.opencode/kompass.jsonc`.

## Workspace

This repository is the Kompass development workspace.

- `packages/core`: shared workflows, prompts, components, config loading, and tool definitions
- `packages/opencode`: the OpenCode adapter package, published as `@kompassdev/opencode`
- `packages/web`: docs site and web content
- `packages/opencode/.opencode/`: generated OpenCode output for review

When changing Kompass itself, keep runtime definitions, bundled config, schema, docs, and generated output in sync in the same change.
