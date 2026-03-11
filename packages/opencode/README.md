<p align="center">
  <img src="assets/kompass.png" alt="Kompass" height="300" />
</p>

# @kompassdev/opencode

`@kompassdev/opencode` is an OpenCode plugin that helps your agent navigate repositories with fewer wrong turns.

It brings Kompass workflows, focused agents, and structured repository tools into OpenCode so sessions stay grounded in branch, PR, and ticket context instead of wandering through the repo from scratch.

`@kompassdev/opencode` is under active development, so commands, tools, and integration details may keep evolving as Kompass matures.

Why people use it:

- help OpenCode navigate codebases with more direction and less drift
- load branch, PR, and ticket context through purpose-built tools
- keep planning, review, implementation, and PR work consistent across sessions

## Installation

Add the plugin to your OpenCode config:

```json
{
  "plugin": ["@kompassdev/opencode"]
}
```

Config is optional. To add a Kompass config file to your project:

```bash
# Inside .opencode folder
curl -fsSL https://raw.githubusercontent.com/kompassdev/kompass/main/.opencode/kompass.jsonc -o .opencode/kompass.jsonc

# Project root
curl -fsSL https://raw.githubusercontent.com/kompassdev/kompass/main/kompass.jsonc -o kompass.jsonc
```

Kompass prefers `.opencode/kompass.jsonc`, then `kompass.jsonc`, and still accepts the legacy `.json` filenames.

## How To Use

Use `@kompassdev/opencode` when you want Kompass workflows available directly inside OpenCode.

- install the plugin in your OpenCode config
- optionally add `.opencode/kompass.jsonc` or `kompass.jsonc` to customize commands, agents, tools, skills, and defaults
- bundled Kompass skills are registered automatically when the plugin loads; users do not need to copy skill files manually
- run commands like `/review`, `/pr/create`, or `/ticket/plan` inside OpenCode
- for session debugging, use `opencode session list` to find a session id and `opencode export <session-id>` to inspect the raw session output

If you want OpenCode to see a Kompass tool under a custom name, set it directly on that tool entry:

```jsonc
{
  "tools": {
    "ticket_sync": {
      "enabled": true,
      "name": "custom_ticket_name"
    }
  }
}
```

That registers `custom_ticket_name` instead of `kompass_ticket_sync`, and command or agent prompts are rewritten to use the custom name.

You can also control discovered skills through `kompass.jsonc`:

```jsonc
{
  "skills": {
    "entries": {
      "release-checklist": { "enabled": true },
      "@acme/opencode-release/hotfix-triage": { "enabled": true },
      "legacy-release-flow": { "enabled": false }
    },
    "plugins": {
      "entries": {
        "@acme/opencode-experimental": { "enabled": false }
      }
    }
  }
}
```

- omit `skills.entries` to allow all discovered skills by default
- set a skill entry to `{ "enabled": false }` to disable it by short name or fully-qualified id
- set a plugin entry to `{ "enabled": false }` to disable all skills from that plugin without disabling the plugin itself

## Agents

This package currently exposes two focused agents through OpenCode:

- `planner`: turns a request or ticket into a scoped implementation plan
- `reviewer`: reviews branch or PR changes without editing files

## Commands

Current command workflows include:

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

`@kompassdev/opencode` includes Kompass tools that give OpenCode focused, structured context for repository workflows.

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
- `description` (optional): short issue description rendered above checklist sections
- `labels` (optional): labels to apply when creating or updating the issue
- `checklists` (optional): structured checklist sections rendered as markdown, for example `### Requirement` followed by `- [ ] Item 1`
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
- useful after making changes to `kompass.jsonc`

</details>

## Local Development

This package lives in the Kompass workspace and loads shared logic directly from `packages/core` during local development.

From the workspace root, run:

```bash
bun run compile
bun run typecheck
bun run test
```

`bun run compile` regenerates `packages/opencode/.opencode/` from the current workspace sources.
