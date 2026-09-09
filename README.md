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
- Structured tools keep workflows grounded in repo and GitHub state: `changes_load`, `pr_load`, `pr_load_review`, `pr_sync`, `ticket_load`, `ticket_sync`. Navigator adds nine session/worktree tools on OpenCode 1 and eight native orchestration tools on OpenCode 2.
- Reusable command-template components live in `packages/core/components/` and are documented in the components reference.

## Prerequisites

- **GitHub CLI** (`gh`) must be installed and authenticated. Kompass uses `gh` for all GitHub operations (PRs, issues, reviews). Install from [cli.github.com](https://cli.github.com/) and run `gh auth login`.

## Installation

The same package supports both OpenCode plugin APIs. For OpenCode 1, add:

```json
{
  "plugin": ["@kompassdev/opencode"]
}
```

For OpenCode 2, use the plural `plugins` key:

```json
{
  "plugins": ["@kompassdev/opencode"]
}
```

OpenCode 1 handles command expansion natively. On OpenCode 2, the plugin inserts the raw input at `$ARGUMENTS`, or appends it when that placeholder is absent. Numbered placeholders and shell interpolation in custom command templates are not supported by the v2 adapter. OpenCode 2 agent transforms create missing agent IDs, including renamed Kompass agents.

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

## OpenCode 2 worktrees

Kompass registers `rift` as a native OpenCode 2 worktree strategy using its bundled `rift-snapshot` dependency. It becomes the location's default for API calls that omit a strategy. Desktop's current New worktree action explicitly selects Git, so that button does not use Rift; Kompass's `worktree_create` tool uses the registered default. This requires a recent V2 release with plugin worktree strategies and returned-directory support; the adapter targets `@opencode/plugin` beta `19381`.

Load Kompass in OpenCode's `opencode.jsonc`; no destination setting is needed:

```jsonc
{
  "plugins": ["@kompassdev/opencode"]
}
```

Rift creates a copy-on-write snapshot of the source checkout, including dependencies and uncommitted files. Rift controls storage using its default `.rifts/<repo>/<name>` layout beside the source root; OpenCode records the returned directory. The strategy uses OpenCode's suggested name, suffixing collisions in Rift's storage, but does not use OpenCode's destination override or `worktree.directory` setting. Rift's configured creation hooks run, followed by OpenCode's project setup. Rift cannot select a starting branch or ref. Use an explicit `strategy: "git"` when creating from a ref.

Inventory includes sibling and nested snapshots. Removal requests force confirmation for uncommitted files and requires child snapshots to be removed first, even with force. Rift moves removed snapshots to its trash; its `gc` operation reclaims that storage.

The last active strategy registration wins. Unloading Kompass restores the previous default; existing snapshots keep their Rift owner and need the plugin available for removal. Rift errors are surfaced without a Git fallback. The strategy uses Rift's native bindings, loaded on first use, and requires a supported copy-on-write filesystem. Its synchronous native calls cannot be interrupted mid-operation; cancellation is checked between calls.

## OpenCode 2 session orchestration

Worktrees and sessions have separate lifecycles. `kompass_worktree_create({ name?, strategy?, branch? })` creates a worktree without a session. Pass its returned `directory` to `session_create`. Omit `directory` to use the calling session's current location, including when it is already in a worktree. Omit `prompt` to create an idle session, then start it with `session_send`. With a prompt, creation starts execution immediately. `session_send` targets a session ID and uses that session's location.

`kompass_worktree_remove({ directory, force? })` removes a managed worktree through OpenCode. It rejects the checkout and any worktree containing the calling session or plugin. `force` defaults to false; true permits discarding uncommitted files. Rift still rejects snapshots with children. V2 cannot discover other active sessions, so finish or interrupt known sessions in that directory before removal. Removing a worktree does not delete its sessions.

Navigator is enabled by default on V2 and exposes `kompass_worktree_create`, `kompass_worktree_list`, `kompass_worktree_remove`, `kompass_session_create`, `kompass_session_read`, `kompass_session_send`, `kompass_session_wait`, and `kompass_session_interrupt`. Use these for explicitly requested native-session workflows. Ordinary delegation uses OpenCode's built-in subagent tool.

For example, call `kompass_worktree_create` with `{ "name": "parser-fix" }`, then pass the returned directory to `kompass_session_create`:

```json
{
  "prompt": "Implement the parser fix and run its tests.",
  "title": "Parser fix",
  "directory": "/projects/.rifts/repo/parser-fix"
}
```

Session creation inherits the caller's agent/model/variant unless overridden, admits the optional first prompt, and returns the session ID and directory immediately. Explicit directories may select the project checkout or a managed worktree; relative paths resolve from the caller's directory. Session creation never creates or removes worktrees. V2 model overrides use `{ "providerID": "...", "id": "...", "variant": "..." }`. On `worktree_create`, a starting `branch` requires `strategy: "git"`; Rift uses the source checkout's state.

Use the returned session ID to send steered or queued follow-ups, read bounded current context, wait for completion, or interrupt execution. Waits use the native Effect API, support one to eight targets, and release wait subscriptions on timeout or cancellation without interrupting the target sessions. `timeoutMs` must be positive and is capped by `maxWaitMs`. Reads use the current model context, not paginated full history. Partial failures report known resources and preserve them for recovery.

The existing `adapters.opencode.navigator.enabled`, tool aliases/disables, `maxReadChars`, `maxOutputCharsPerItem`, and `maxWaitMs` settings apply to V2. `session_list` and the `maxConcurrentSessions` limit remain V1-only because the V2 plugin context lacks session discovery. Known session IDs continue to work after plugin reloads; Kompass does not keep its own session registry.

## OpenCode 1 Navigator

V1 also uses `session_create({ directory?, prompt?, agent?, model? })`: omit directory for the calling session's location, or pass the directory from a separate `worktree_create` call. The old `environment` argument has been removed. Omit prompt for an idle session. On the legacy session protocol, agent/model selection happens only when prompting, so supply those overrides to `session_send` when starting an idle session. V1 model overrides use `modelID`; V2 uses `id`.

Navigator's OpenCode 1 adapter provides nine tools, including standalone `worktree_create({ name?, startCommand? })`. It prefers Rift when available; `startCommand` selects Git. V1 removal checks active sessions and has no force option. Ordinary delegation uses OpenCode's built-in `task` tool. Navigator follows Desktop's protocol detection and requires OpenCode `1.17.12` or newer.

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

Navigator accepts only sessions from the current OpenCode project and only worktrees returned by OpenCode. New sessions inherit the calling session's agent, model, and variant unless explicitly overridden. It rejects self-targeting lifecycle calls, arbitrary directories, unknown V2 agent overrides, main-checkout removal, unmanaged worktrees, and removal while a worktree has active sessions. `session_send` can switch the target session's agent or model before admitting a steered prompt when the detected OpenCode protocol supports it. `session_wait` defaults to `maxWaitMs`, caps requested timeouts at `maxWaitMs`, and treats `timeoutMs: 0` as an immediate snapshot. Navigator never force-removes or automatically cleans up resources after a partial failure.

On OpenCode 1, when experimental workspace adapters are available, Kompass registers a `rift` workspace adapter backed by its bundled `rift-snapshot` dependency. `worktree_create` uses that adapter when no `startCommand` is requested, using Git worktrees otherwise. Pass its returned directory to `session_create`.

Kompass preserves the OpenCode workspace ID when it creates future sessions in Rift workspaces. Existing sessions without workspace identity are not migrated automatically. Rift workspaces are experimental OpenCode workspaces, not legacy Desktop sandboxes, and Kompass does not modify `project.sandboxes` or OpenCode's workspace database.

Current OpenCode Desktop versions may not display adapter-backed workspaces until Desktop adopts the experimental workspace API. Desktop also currently filters Home sessions through legacy sandbox metadata, does not enumerate experimental adapters, and OpenCode synchronization may retain stale or duplicate workspace records. Users can select or move sessions between available locations with the TUI `/warp` workflow. OpenCode's public plugin workspace adapter type also needs to expose the runtime-supported optional `list()` method upstream.

## Workspace

This repository is the Kompass development workspace.

- `packages/core`: shared workflows, prompts, components, config loading, and tool definitions
- `packages/opencode`: the OpenCode adapter package, published as `@kompassdev/opencode`
- `packages/web`: docs site and web content
- `packages/opencode/.opencode/`: generated OpenCode output for review

When changing Kompass itself, keep runtime definitions, bundled config, schema, docs, and generated output in sync in the same change.
