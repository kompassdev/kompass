> Kompass is under active development, so workflows, package APIs, and adapter support may keep evolving as the toolkit expands.

<p align="center">
  <img src="https://raw.githubusercontent.com/kompassdev/kompass/main/assets/kompass.png" alt="Kompass" height="300" />
  <br>
  <em>Navigate your way - manual steering, steered autonomy, or autonomously.</em>
</p>

Kompass keeps AI coding agents on course with token-efficient, composable workflows. **Finally, your agent stops wandering.**

Whether you prefer full control, guided collaboration, or hands-off autonomy, Kompass adapts to how you work.

## Choose Your Mode

<p>**🧭 Manual Steering** — You chart the course, the agent follows your lead</p>
<p>**⚓ Collaborative** — Plan together, develop together, review together</p>
<p>**🚢 Autonomous** — Let your agent navigate independently, review at checkpoints</p>

## Why Kompass?

| Challenge | How Kompass Helps |
|-----------|-------------------|
| Agents wander without direction | 🧭 **Navigation** — structured workflows keep agents on course |
| Rebuilding prompts for every agent | 🔌 **Plug & Play** — same workflows across OpenCode, Claude Code, and more |
| Token bloat in long sessions | 🎯 **Token Efficient** — minimal, focused prompts that get to the point |
| Ad-hoc planning and review | ⚓ **Workflows** — purpose-built flows for plan, dev, and review |
| Generic tools miss context | 🛠️ **Tailored Tools** — purpose-built for repository work |
| Complex setup overhead | ⚡ **Easy to Use** — install the plugin, start navigating |

## Installation

For OpenCode, add the adapter package to your config:

```json
{
  "plugin": ["@kompassdev/opencode"]
}
```

Config is optional. To publish a project override:

```bash
# Inside .opencode folder
curl -fsSL https://raw.githubusercontent.com/kompassdev/kompass/main/kompass.jsonc -o .opencode/kompass.jsonc

```

Kompass ships a bundled base config, then applies the first matching consumer-project override in this order: `.opencode/kompass.jsonc`, `.opencode/kompass.json`, `kompass.jsonc`, `kompass.json`.

## How To Use

### OpenCode

Use `@kompassdev/opencode` when you want Kompass workflows inside OpenCode.

- install the plugin in your OpenCode config
- optionally add one project override file to customize commands, agents, tools, skills, and defaults; `.opencode/kompass.jsonc` is preferred
- bundled Kompass skills are registered automatically when the plugin loads, so users do not need to copy skill files manually
- use commands like `/ask`, `/review`, `/pr/create`, or `/ticket/plan` inside OpenCode
- for CLI session debugging, use `opencode session list` to find a session id and `opencode export <sessionID>` to dump the raw session JSON

### Claude Code

Claude Code adapter support is coming soon.

Kompass is being structured as a shared core toolkit with adapter-specific packages, so the same workflows can be reused across agents instead of rebuilt from scratch.

## Agents

### `worker`

Handles generic implementation work and can ask targeted follow-up questions when execution is blocked.

### `navigator`

Coordinates structured multi-step workflows by keeping orchestration local and delegating only focused leaf work to subagents.

### `planner`

Turns a request or ticket into a scoped implementation plan.

### `reviewer`

Reviews branch or PR changes without editing files.

## Commands

### `/ask`

Answers questions about the current project or codebase.

<details>

**Usage:** `/ask <question>`

Loads only the relevant repository context needed to answer a project or code question directly.

</details>

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

### `/todo`

Works through a todo file task by task.

<details>

**Usage:** `/todo [todo-file]`

Loads a todo list, delegates one item at a time, and keeps orchestration local so work can pause and resume cleanly.

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

### `/ticket/ask`

Answers a question on a ticket and posts the response.

<details>

**Usage:** `/ticket/ask <ticket-reference> <question>`

Loads the ticket plus all comments, answers the question using ticket and repository context, and posts the response back to the same ticket.

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

### `pr_sync`

Create, update, or review a GitHub pull request with structured checklists.

<details>

**Parameters:**

- `title` (optional): PR title; required when creating a PR or renaming one
- `body` (optional): raw PR body override
- `description` (optional): short PR description rendered above checklist sections
- `base` (optional): base branch to merge into
- `head` (optional): head branch to use when creating a PR
- `checklists` (optional): structured checklist sections (e.g., Testing, Summary)
- `draft` (optional): create as draft PR
- `refUrl` (optional): PR URL to update instead of creating new
- `commitId` (optional): commit SHA to anchor review comments to
- `review` (optional): structured review submission with optional `body`, inline `comments`, and `approve` flag
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

- `title` (optional): issue title; required when creating a new issue or renaming one
- `body` (optional): raw issue body override
- `description` (optional): short issue description rendered above checklist sections
- `labels` (optional): labels to apply when creating or updating the issue
- `checklists` (optional): structured checklist sections rendered as markdown
- `refUrl` (optional): issue URL to update instead of creating a new issue
- `comments` (optional): issue comments to post without replacing the issue body

**Why it helps:**

- lets ticket flows create a new issue, update an existing one, or post a ticket comment with one tool
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

If you want to customize Kompass, use one of these project override locations in precedence order:

- `.opencode/kompass.jsonc`
- `.opencode/kompass.json`
- `kompass.jsonc`
- `kompass.json`

See `kompass.jsonc` for the published base config, `.opencode/kompass.jsonc` for the preferred consumer-project override shape, and `kompass.schema.json` for the schema.

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
