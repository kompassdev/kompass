> Kompass is under active development, so workflows, package APIs, and adapter support may keep evolving as the toolkit expands.

<p align="center">
  <img src="https://raw.githubusercontent.com/kompassdev/kompass/main/assets/kompass.png" alt="Kompass" height="300" />
  <br>
  <em>Navigate your way - manual steering, steered autonomy, or autonomously.</em>
</p>

Kompass keeps AI coding agents on course with token-efficient, composable workflows.

## Docs

- Main docs: `https://kompassdev.ai/docs/`
- Getting started: `https://kompassdev.ai/docs/getting-started/`
- OpenCode adapter: `https://kompassdev.ai/docs/adapters/opencode/`
- Config reference: `https://kompassdev.ai/docs/config/overview/`
- Command, agent, and tool reference: `https://kompassdev.ai/docs/reference/commands/`, `https://kompassdev.ai/docs/reference/agents/`, `https://kompassdev.ai/docs/reference/tools/`

## Installation

For OpenCode, add the adapter package to your config:

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
