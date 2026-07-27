> Kompass is under active development, so workflows, package APIs, and adapter support may keep evolving as the toolkit expands.

<p align="center">
  <img src="https://raw.githubusercontent.com/kompassdev/kompass/main/assets/kompass.png" alt="Kompass" height="300" />
  <br>
  <em>Navigate your way - manual steering, steered autonomy, or autonomously.</em>
</p>

Kompass keeps AI coding agents on course with token-efficient, composable workflows.

## Docs

- Main docs: https://kompassdev.ai/docs/
- Getting started: https://kompassdev.ai/docs/getting-started/
- OpenCode adapter: https://kompassdev.ai/docs/adapters/opencode/
- Config reference: https://kompassdev.ai/docs/config/overview/
- Command, agent, tool, and component reference: https://kompassdev.ai/docs/reference/commands/, https://kompassdev.ai/docs/reference/agents/, https://kompassdev.ai/docs/reference/tools/, https://kompassdev.ai/docs/reference/components/

## Bundled Surface

- Commands cover direct work (`/ask`, `/commit`, `/merge`, `/skill/create`, `/skill/optimize`), orchestration (`/dev`, `/ship`, `/todo`, `/pr/fix/loop`), ticket planning/sync, and PR review/shipping flows. `/branch/inline`, `/commit/inline`, `/commit-and-push/inline`, `/pr/create/inline`, and `/ship/inline` reuse the invoking session instead of starting a subtask.
- Agents are intentionally narrow: `worker` handles implementation and multi-step workflows, `planner` is no-edit planning, and `reviewer` is a no-edit review specialist.
- Structured tools keep workflows grounded in repo and GitHub state: `changes_load`, `pr_load`, `pr_load_review`, `pr_sync`, `ticket_load`, `ticket_sync`. OpenCode users can opt into the eight Navigator session and worktree tools.
- Reusable command-template components live in `packages/core/components/` and are documented in the components reference.

## Prerequisites

- **GitHub CLI** (`gh`) must be installed and authenticated. Kompass uses `gh` for all GitHub operations (PRs, issues, reviews). Install from [cli.github.com](https://cli.github.com/) and run `gh auth login`.

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

## Kompass Navigator

Navigator is an OpenCode capability for orchestrating native sessions in the current checkout and OpenCode-managed Git worktrees. It is enabled by default, follows OpenCode Desktop's protocol detection so session creation, prompts, reads, status, and interrupts stay on one compatible API, returns immediately after admitting prompts, and supports parallel sessions. Until OpenCode implements V2 wait, Navigator waits by polling the active-session API locally. It requires OpenCode `1.17.12` or newer.

Configure Navigator and its limits with:

```jsonc
{
  "adapters": {
    "opencode": {
      "navigator": {
        "enabled": true,
        "maxConcurrentSessions": 8,
        "maxReadChars": 20000,
        "maxOutputCharsPerItem": 4000,
        "maxWaitMs": 120000
      }
    }
  }
}
```

The default runtime names are `kompass_worktree_list`, `kompass_session_create`, `kompass_session_list`, `kompass_session_read`, `kompass_session_send`, `kompass_session_wait`, `kompass_session_interrupt`, and `kompass_worktree_remove`. Disable or alias any logical name through `tools`; an alias is registered exactly as configured.

Set `adapters.opencode.navigator.enabled` to `false` to disable all Navigator tools.

Navigator accepts only sessions from the current OpenCode project and only worktrees returned by OpenCode. It rejects self-targeting lifecycle calls, arbitrary directories, main-checkout removal, unmanaged worktrees, and removal while a worktree has active sessions. `session_send` can switch the target session's agent or model before admitting a steered prompt when the detected OpenCode protocol supports it. `session_wait` defaults to `maxWaitMs`, caps requested timeouts at `maxWaitMs`, and treats `timeoutMs: 0` as an immediate snapshot. Navigator never force-removes or automatically cleans up resources after a partial failure.

When OpenCode exposes experimental workspace adapters, Kompass registers a `rift` workspace adapter backed by its bundled `rift-snapshot` dependency. Navigator automatically uses that adapter for `new_worktree` sessions when no `startCommand` is requested, falling back to Git worktrees otherwise.

## Workspace

This repository is the Kompass development workspace.

- `packages/core`: shared workflows, prompts, components, config loading, and tool definitions
- `packages/opencode`: the OpenCode adapter package, published as `@kompassdev/opencode`
- `packages/web`: docs site and web content
- `packages/opencode/.opencode/`: generated OpenCode output for review

When changing Kompass itself, keep runtime definitions, bundled config, schema, docs, and generated output in sync in the same change.
