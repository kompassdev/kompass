# @kompassdev/opencode

OpenCode adapter for Kompass.

Kompass provides structured commands, agents, tools, and skills so AI coding workflows stay reviewable and focused instead of drifting across long sessions.

## Docs

- Main docs: `https://kompassdev.ai/docs/`
- OpenCode adapter: `https://kompassdev.ai/docs/adapters/opencode/`
- Config reference: `https://kompassdev.ai/docs/config/overview/`
- Command reference: `https://kompassdev.ai/docs/reference/commands/`
- Agent reference: `https://kompassdev.ai/docs/reference/agents/`
- Tool reference: `https://kompassdev.ai/docs/reference/tools/`

## Installation

Add the adapter package to your OpenCode config:

```json
{
  "plugin": ["@kompassdev/opencode"]
}
```

## Optional project config

To start from the published base config:

```bash
curl -fsSL https://raw.githubusercontent.com/kompassdev/kompass/main/kompass.jsonc -o .opencode/kompass.jsonc
```

Kompass loads the bundled base config, then optional home-directory overrides, then optional project overrides. In each location it uses the first file that exists from:

- `.opencode/kompass.jsonc`
- `.opencode/kompass.json`
- `kompass.jsonc`
- `kompass.json`

The recommended project override path is `.opencode/kompass.jsonc`.

## What the adapter provides

- Kompass commands
- Kompass agent roles
- Kompass tools
- bundled skill registration
- project override loading from local config files

Most command execution uses OpenCode's built-in `build` agent. Kompass also ships the `worker`, `navigator`, `planner`, and `reviewer` roles for structured subagent workflows.
