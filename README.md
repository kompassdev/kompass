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
curl -fsSL https://raw.githubusercontent.com/kompassdev/kompass/main/.opencode/kompass.jsonc -o .opencode/kompass.jsonc

# Project root
curl -fsSL https://raw.githubusercontent.com/kompassdev/kompass/main/kompass.jsonc -o kompass.jsonc
```

Kompass prefers `.opencode/kompass.jsonc`, then `kompass.jsonc`, and still accepts the legacy `.json` filenames.

## How To Use

### OpenCode

Use `@kompassdev/opencode` when you want Kompass workflows inside OpenCode.

- install the plugin in your OpenCode config
- optionally add `.opencode/kompass.jsonc` or `kompass.jsonc` to customize commands, agents, tools, skills, and defaults
- bundled Kompass skills are registered automatically when the plugin loads, so users do not need to copy skill files manually
- use commands like `/review`, `/pr/create`, or `/ticket/plan` inside OpenCode
- for CLI session debugging, use `opencode session list` to find a session id and `opencode export <sessionID>` to dump the raw session JSON

### Claude Code

Claude Code adapter support is coming soon.

Kompass is being structured as a shared core toolkit with adapter-specific packages, so the same workflows can be reused across agents instead of rebuilt from scratch.

## Agents

### `navigator`

Coordinates multi-step workflows like `/todo` and `/ship` by keeping orchestration local and delegating focused leaf work to subagents.

### `planner`

Turns a request or ticket into a scoped implementation plan.

### `reviewer`

Reviews branch or PR changes without editing files.

## Commands

### `/commit`

Stages and commits changes with a generated message.

<details>

**Usage:** `/commit [message]`

If a message is provided, commits with that message. Otherwise, generates an appropriate commit message based on the staged changes.

</details>

### `/commit-and-push`

Stages, commits, and pushes changes in one workflow.

<details>

**Usage:** `/commit-and-push [message]`

Commits changes (generating a message if not provided) and pushes to the remote repository.

</details>

### `/dev`

Implementation mode for focused development work.

<details>

**Usage:** `/dev <description>`

Use for active development tasks. The agent implements the described changes while staying focused on the task.

</details>

### `/learn`

Learns patterns and conventions from existing code.

<details>

**Usage:** `/learn <what-to-learn>`

Analyzes the codebase to understand patterns, conventions, or specific implementations. Useful for understanding how things work before making changes.

</details>

### `/pr/create`

Creates a pull request with structured checklists.

<details>

**Usage:** `/pr/create [title]`

Creates a PR from the current branch. Generates a title if not provided. Includes checklist sections for consistent PR structure.

</details>

### `/pr/fix`

Fixes issues found during PR review.

<details>

**Usage:** `/pr/fix [context]`

Addresses review comments and feedback on an open PR. Loads the PR context and works through requested changes.

</details>

### `/pr/review`

Reviews a pull request and adds structured feedback.

<details>

**Usage:** `/pr/review [pr]`

Reviews the specified PR (or current PR if not specified) and provides feedback using inline comments and review threads.

</details>

### `/reload`

Reloads the OpenCode project cache.

<details>

**Usage:** `/reload`

Refreshes config, commands, agents, and tools without restarting OpenCode. Useful after making changes to `kompass.jsonc`.

</details>

### `/review`

Reviews branch changes for issues and improvements.

<details>

**Usage:** `/review [base]`

Reviews uncommitted changes or changes against a base branch (default: main). Provides feedback on code quality, patterns, and potential issues.

</details>

### `/ship`

Ships the fast path from change summary to commit and PR creation.

<details>

**Usage:** `/ship [base-or-context]`

Summarizes current changes, creates a feature branch when you are still on the base branch, then delegates the commit and PR steps to `/commit` and `/pr/create`.

</details>

### `/rmslop`

Removes unnecessary code and simplifies.

<details>

**Usage:** `/rmslop`

Analyzes the codebase for unnecessary complexity, unused code, and opportunities for simplification.

</details>

### `/ticket/create`

Creates a GitHub issue from a description.

<details>

**Usage:** `/ticket/create <description>`

Creates a new GitHub issue with the provided description, generating a title and structured body with checklists.

</details>

### `/ticket/dev`

Implements a ticket with planning and execution.

<details>

**Usage:** `/ticket/dev <ticket-reference>`

Loads the specified ticket (URL, #id, or file path), creates an implementation plan, and executes the work.

</details>

### `/ticket/plan`

Creates an implementation plan for a ticket.

<details>

**Usage:** `/ticket/plan <ticket-reference>`

Loads the specified ticket and creates a detailed implementation plan without executing changes.

</details>

## Tools

### `changes_load`

Load branch changes against a base branch.

<details>

**Parameters:**

- `base` (optional): base branch or ref
- `head` (optional): head branch, commit, or ref override
- `depthHint` (optional): shallow-fetch hint such as PR commit count
- `uncommitted` (optional): only load uncommitted changes (staged and unstaged), never fall back to branch comparison

**Why it helps:**

- keeps branch diff loading focused
- works well for review and PR workflows
- handles workspace changes separately from committed branch diffs

</details>

### `pr_load`

Load PR metadata and review history.

<details>

**Parameters:**

- `pr` (optional): PR number or URL

**Why it helps:**

- gives agents normalized PR context before they start reviewing or summarizing
- keeps review workflows grounded in actual PR state instead of inferred context

</details>

### `pr_review`

Legacy PR comment helper for general comments, inline comments, or thread replies. Prefer `pr_sync` for new workflows.

<details>

**Parameters:**

- `comment_type` (required): type of comment - "general", "inline", or "reply"
- `body` (required): comment text
- `pr` (optional): PR number or URL (uses current PR if not provided)
- `commit_id` (optional): commit SHA for inline comments
- `path` (optional): file path for inline comments
- `line` (optional): line number for inline comments
- `in_reply_to` (optional): comment ID to reply to

**Why it helps:**

- kept for backwards compatibility with existing automations
- no shell escaping issues with backticks or quotes
- replies automatically fetch parent comment context

</details>

### `pr_sync`

Create, update, or review a GitHub pull request with structured checklists.

<details>

**Parameters:**

- `title` (optional): PR title; required when creating a PR or renaming one
- `body` (optional): raw PR body override
- `description` (optional): short PR description rendered above checklist sections
- `base` (optional): base branch to merge into
- `checklists` (optional): structured checklist sections (e.g., Testing, Summary)
- `draft` (optional): create as draft PR
- `refUrl` (optional): PR URL to update instead of creating new
- `approve` (optional): approve the referenced PR without posting a comment body
- `review` (optional): structured review submission with `event`, optional `body`, optional `commitId`, and inline `comments`
- `replies` (optional): replies to existing review comments
- `commentBody` (optional): general PR comment body

**Why it helps:**

- consistent PR creation with checklist support
- create, update, review, approve, and reply with one tool
- no shell escaping issues

</details>

### `ticket_load`

Load a ticket from GitHub, file, or text.

<details>

**Parameters:**

- `source` (required): issue URL, repo#id, #id, file path, or raw text
- `comments` (optional): include issue comments

**Why it helps:**

- lets the same workflow start from GitHub, a local file, or pasted text
- gives planning and implementation flows a consistent input format

</details>

### `ticket_sync`

Create or update a GitHub issue with checklists.

<details>

**Parameters:**

- `title` (required): issue title
- `body` (optional): raw issue body override
- `description` (optional): short issue description rendered above checklist sections
- `labels` (optional): labels to apply when creating or updating the issue
- `checklists` (optional): structured checklist sections rendered as markdown
- `refUrl` (optional): issue URL to update instead of creating a new issue

**Why it helps:**

- lets ticket flows create a new issue or update an existing one with one tool
- avoids making the agent handcraft raw `gh` issue commands each time

</details>

### `reload`

Refresh the OpenCode project cache.

<details>

**Parameters:** none

**Why it helps:**

- refresh config, commands, and tools without restarting
- useful after making changes to `kompass.jsonc`

</details>

## Config

Project config is optional.

If you want to customize Kompass, use one of these preferred locations in the consumer project:

- `.opencode/kompass.jsonc`
- `kompass.jsonc`

See `kompass.jsonc` for the root example, `packages/opencode/.opencode/kompass.jsonc` for the compiled OpenCode-scoped example, and `kompass.schema.json` for the schema.

Tool names can also be remapped per adapter. For example, this keeps `ticket_sync` enabled but exposes it as `custom_ticket_name`, and Kompass command or agent references are rewritten to match:

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
