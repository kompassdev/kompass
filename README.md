<p align="center">
  <img src="assets/kompass.png" alt="Kompass" height="300" />
</p>

# Kompass

Kompass helps coding agents navigate repositories with fewer wrong turns.

It packages reusable workflows, focused agents, and structured repository tools so planning, review, ticket work, and pull request prep stay grounded in real project context instead of broad repo guesswork.

Kompass is under active development, so workflows, package APIs, and adapter support may keep evolving as the toolkit expands.

Why people use it:

- help agents navigate codebases with more direction and less drift
- load branch, PR, and ticket context into workflows built for real repository work
- reuse one shared workflow system across coding agents instead of rebuilding the same prompts each time

Today, Kompass supports OpenCode through `@kompassdev/opencode`.

The toolkit is structured so additional adapters can plug into the same core workflows over time, with Claude Code support planned next.

## Installation

For OpenCode, add the adapter package to your config:

```json
{
  "plugin": ["@kompassdev/opencode"]
}
```

Config is optional. To publish a config file:

```bash
# Inside .opencode folder
curl -fsSL https://raw.githubusercontent.com/kompassdev/kompass/main/.opencode/kompass.json -o .opencode/kompass.json

# Project root
curl -fsSL https://raw.githubusercontent.com/kompassdev/kompass/main/kompass.json -o kompass.json
```

Kompass looks for `.opencode/kompass.json` first, then `kompass.json`.

## How To Use

### OpenCode

Use `@kompassdev/opencode` when you want Kompass workflows inside OpenCode.

- install the plugin in your OpenCode config
- optionally add `.opencode/kompass.json` or `kompass.json` to customize commands, agents, tools, and defaults
- use commands like `/review`, `/pr/create`, or `/ticket/plan` inside OpenCode
- for CLI session debugging, use `opencode session list` to find a session id and `opencode export <sessionID>` to dump the raw session JSON

### Claude Code

Claude Code adapter support is coming soon.

Kompass is being structured as a shared core toolkit with adapter-specific packages, so the same workflows can be reused across agents instead of rebuilt from scratch.

## Agents

Kompass currently includes two focused agents:

- `planner`: turns a request or ticket into a scoped implementation plan
- `reviewer`: reviews branch or PR changes without editing files

## Commands

Kompass currently ships these command workflows:

- `/commit`
- `/commit-and-push`
- `/dev`
- `/learn`
- `/pr/create`
- `/pr/fix`
- `/pr/review`
- `/reload`
- `/review`
- `/rmslop`
- `/ticket/create`
- `/ticket/dev`
- `/ticket/plan`

## Tools

Kompass includes handcrafted tools that return focused, structured data for specific workflows instead of forcing the agent to rediscover everything through broad repo exploration.

- `changes_load`: load branch changes against a base branch
- `pr_load`: load PR metadata and review history
- `pr_review`: add PR comments (general, inline, or reply to threads)
- `pr_sync`: create or update a pull request with checklists
- `ticket_load`: load a ticket from GitHub, file, or text
- `ticket_sync`: create or update a GitHub issue with checklists
- `reload`: refresh the OpenCode project cache

<details>
<summary><strong>`changes_load` details</strong></summary>

Load branch changes against a base branch.

Parameters:

- `base` (optional): base branch or ref
- `head` (optional): head branch, commit, or ref override
- `depthHint` (optional): shallow-fetch hint such as PR commit count
- `uncommitted` (optional): include uncommitted workspace changes

Why it helps:

- keeps branch diff loading focused
- works well for review and PR workflows
- handles workspace changes separately from committed branch diffs

</details>

<details>
<summary><strong>`pr_load` details</strong></summary>

Load PR metadata and review history.

Parameters:

- `pr` (optional): PR number or URL

Why it helps:

- gives agents normalized PR context before they start reviewing or summarizing
- keeps review workflows grounded in actual PR state instead of inferred context

</details>

<details>
<summary><strong>`ticket_load` details</strong></summary>

Load a ticket from GitHub, file, or text.

Parameters:

- `source` (required): issue URL, repo#id, #id, file path, or raw text
- `comments` (optional): include issue comments

Why it helps:

- lets the same workflow start from GitHub, a local file, or pasted text
- gives planning and implementation flows a consistent input format

</details>

<details>
<summary><strong>`ticket_sync` details</strong></summary>

Create or update a GitHub issue.

Parameters:

- `title` (required): issue title
- `body` (optional): raw issue body override
- `refUrl` (optional): issue URL to update instead of creating a new issue

Why it helps:

- lets ticket flows create a new issue or update an existing one with one tool
- avoids making the agent handcraft raw `gh` issue commands each time

</details>

<details>
<summary><strong>`pr_review` details</strong></summary>

Add comments to a PR: general PR comment, inline review comment on specific lines, or reply to existing review threads.

Parameters:

- `comment_type` (required): type of comment - "general", "inline", or "reply"
- `body` (required): comment text
- `pr` (optional): PR number or URL (uses current PR if not provided)
- `commit_id` (optional): commit SHA for inline comments
- `path` (optional): file path for inline comments
- `line` (optional): line number for inline comments
- `in_reply_to` (optional): comment ID to reply to

Why it helps:

- handles all PR comment scenarios in one tool
- no shell escaping issues with backticks or quotes
- replies automatically fetch parent comment context

</details>

<details>
<summary><strong>`pr_sync` details</strong></summary>

Create or update a GitHub pull request with structured checklists.

Parameters:

- `title` (required): PR title
- `body` (optional): raw PR body override
- `description` (optional): short PR description rendered above checklist sections
- `base` (optional): base branch to merge into
- `checklists` (optional): structured checklist sections (e.g., Testing, Summary)
- `draft` (optional): create as draft PR
- `refUrl` (optional): PR URL to update instead of creating new

Why it helps:

- consistent PR creation with checklist support
- create or update with one tool
- no shell escaping issues

</details>

<details>
<summary><strong>`reload` details</strong></summary>

Reload the OpenCode project cache.

Parameters: none

Why it helps:

- refresh config, commands, and tools without restarting
- useful after making changes to kompass.json

</details>

## Config

Project config is optional.

If you want to customize Kompass, use one of these preferred locations in the consumer project:

- `.opencode/kompass.json`
- `kompass.json`

See `kompass.json` for the root example, `.opencode/kompass.json` for the OpenCode-scoped example, and `kompass.schema.json` for the schema.

Tool names can also be remapped per adapter. For example, this keeps `ticket_sync` enabled but exposes it as `custom_ticket_name`, and Kompass command or agent references are rewritten to match:

```json
{
  "tools": {
    "ticket_sync": {
      "enabled": true,
      "name": "custom_ticket_name"
    }
  }
}
```

## Workspace

This repository is the Kompass development workspace.

- `packages/core`: shared Kompass workflows, prompts, components, config loading, and tool definitions
- `packages/opencode`: the OpenCode adapter package, published as `@kompassdev/opencode`

The root coordinates workspace scripts, shared config, tests, and compiled review output.

## Workspace Scripts

```bash
bun run compile
bun run typecheck
bun run test
```

`bun run compile` regenerates `packages/opencode/.opencode/` from the OpenCode package.

## Publishing Direction

- publish `packages/opencode` as `@kompassdev/opencode`
- keep shared workflow logic in `packages/core`
- add future adapters as sibling packages, such as `packages/claude-code`
