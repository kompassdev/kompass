---
description: Create a PR in the current session
agent: worker
subtask: false
---

## Goal

Create a pull request for the current branch from its committed changes. Run in the invoking session while loading the final branch comparison as authoritative state.

## Additional Context

Use `<additional-context>` and relevant invoking-session context when writing the PR. Include `Ticket`, `Description`, and `Checklist` sections in that order, and use `SKIPPED` when ticket mention is skipped.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- Store a branch reference as `<base>`
- Store ticket auto-creation as `<ticket-mode>` = `auto`, an explicit ticket reference as `<ticket-url>`, or an explicit skip as `<ticket-mode>` = `skip`
- Store remaining guidance as `<additional-context>`

### Load And Analyze Changes

- Retain the authoritative branch comparison load even though this command runs in the invoking session; do not infer the final base, commit scope, or diff from session memory
#### Load Changes

- call `kompass_changes_load`
- If `<base>` is defined, pass it as `base`; otherwise call the tool with no parameters
- Never pass `uncommitted: true`
- Store the returned result as `<changes>`
- If `<changes>.deferredDiffs` is present, inspect the needed deferred diffs directly one file at a time using the returned comparison and changed paths
#### Analyze And Summarize Changes

- Use `<changes>` as the source of truth; do not run additional git commands to rediscover its comparison
- Note the comparison mode, base branch, and current branch from `<changes>`
- When `<changes>.comparison` is not `uncommitted`, treat `<changes>.commits` as the authoritative scope of work: only summarize commits ahead of the resolved base branch
- Review commit messages when available to understand the delivery narrative
- Review paths, statuses, line counts, and diffs from `<changes>` as file-level context for the commits in scope
- Read only the most relevant changed source files when the diff does not provide enough context
- Identify the nature of changes (added, modified, deleted)
- Group related changes into logical themes
- Summarize the "what" and "why" (not the "how")
- Do not infer scope from branch names or describe work that exists only on the base branch or outside the commits ahead of base

### Check PR Blockers

- Store the current branch from `<changes>` as `<current-branch>` when available
- Store `<resolved-base>` by preferring `<base>`, otherwise use the base implied by `<changes>.comparison`
- If `<changes>.comparison` is `uncommitted`, STOP and report that changes must be committed or stashed
- If `<current-branch>` equals `<resolved-base>`, STOP and report that PR creation requires a work branch
- If `<changes>` contains no files and no commits, STOP and report that there is nothing to include in a PR


### Resolve Ticket

- Preserve an already defined `<ticket-mode>` or `<ticket-url>`
- If `<ticket-url>` is defined, store `<ticket-mode>` as `provided`
- Otherwise, if ticket handling was explicitly skipped, store `<ticket-mode>` as `skip`
- Otherwise, if automatic ticket creation was requested, store `<ticket-mode>` as `auto`
- Otherwise, when `question` is available, ask exactly one `Provide Ticket` question with `Automatically Create` and `Skip` options and custom answers enabled
- When `question` is unavailable, default to `skip`
- Normalize a custom ticket reference as `<ticket-url>` with mode `provided`; never infer `skip` when the user can be asked

### Prepare Ticket Reference

When `<ticket-mode>` is `auto`:
- Reuse the same change themes, rationale, and reviewer-facing validation goals from the current summary work
- For branch comparisons, ensure every theme is supported by commits in `<changes>.commits`; use file diffs only as supporting context
- Generate a concise title (max 70 chars) that reflects the delivered outcome
- Generate a `description` that briefly describes what was accomplished and why it matters
- Generate checklists with:
  - 2-4 functional sections named after user-facing areas or outcomes, not generic labels like `Changes`
  - concise, outcome-focused items under each section that describe what changed for a human reader
  - one final `Validation` section with reviewer-facing confirmation steps that start with `Verify that...`, `Confirm that...`, or `Check that...`
- Keep section names and items concise, human-friendly, and function-oriented
- Merge tiny themes together instead of creating a section per file or implementation detail
- Do not restate the full diff
- Do not use execution-status notes such as `Validation not run in this session` as checklist items
- If `kompass_changes_load` reports uncommitted work, make that clear in the ticket wording
- Use `kompass_ticket_sync` with `assignees: ["@me"]` and store the created issue URL as `<ticket-url>`

Otherwise, preserve the provided `<ticket-url>` or store the literal `SKIPPED` for mode `skip`.

### Push Branch

- If `<current-branch>` is not defined, run `git branch --show-current` and store the trimmed result as `<current-branch>`
- Run `git push` and use its output as the source of truth
- If the current branch has no upstream, retry with `git push -u origin <current-branch>`
- Store whether a push occurred as `<push-status>` and the successful destination as `<push-target>`
- If push fails, STOP and report the push error

### Create PR

- Generate a concise title of at most 70 characters as `<pr-title>`
- Generate a compact description focused on intent and scope
- Build 2-4 outcome-focused checklist sections followed by `Validation`
- Use `kompass_pr_sync` to create the PR with `<resolved-base>` as `base`, `<current-branch>` as `head`, and `assignees: ["@me"]`
- Set `body` with `## Ticket`, `## Description`, and `## Checklist` in that order
- Omit review, replies, commentBody, and commitId
- Store the created or existing PR URL as `<pr-url>` and whether it already existed as `<pr-existing>`

### Output

When complete, display:
```
Created PR: <pr-title>

URL: <pr-url>
Branch: <current-branch> -> <resolved-base>
Ticket: <ticket-url>
Push: <push-status>

No additional steps are required.
```

If `<pr-existing>` is true, replace the first line with `PR already exists`.
