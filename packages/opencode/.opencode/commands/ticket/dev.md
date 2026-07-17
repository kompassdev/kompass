---
description: Implement a ticket and create a PR
agent: worker
---

## Goal

Implement a ticket, create a branch and commit, push it, and create a pull request in one workflow.

## Additional Context

Use `<additional-context>` to refine scope and delivery. Reuse loaded change state across adjacent phases.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- Store the ticket reference, URL, file, or request as `<ticket-source>`
- Store extra delivery guidance as `<additional-context>`

### Load Ticket Context

- Use `kompass_ticket_load` with `source: <ticket-source>`
- Store the result as `<ticket-context>`
- Treat the loaded ticket body, discussion, and any attachments or linked artifacts returned by the loader as part of the source context
- Review attached images, PDFs, and other linked files whenever they can affect requirements, acceptance criteria, reproduction steps, design direction, or the requested answer
- If any relevant attachment cannot be accessed, note that gap and continue only when the remaining ticket context is still sufficient to proceed reliably
- Store a concise `<ticket-summary>` and canonical `<ticket-url>` when available
- STOP if ticket context cannot be loaded

### Implement Ticket

### Development Flow Navigation Guide

- Orient yourself using the normalized request context before editing
- Survey the codebase before plotting the implementation
- Prefer the smallest course correction that fully reaches the destination
- Validate the path with targeted checks before handing off to PR creation
- Surface any detours or follow-up destinations that should stay off the current route
- Implement the smallest complete change for `<ticket-context>` and `<additional-context>`
- Run the most relevant available validation
- Prefer project-native checks such as changed-area tests, linting, type checking, build verification, or other documented validation steps when they exist
- If a category of validation is not available in the project, note it explicitly instead of inventing a command
- Store results as `<validation-results>` and STOP if required validation fails

### Load Uncommitted Changes Once

#### Load Changes

- call `kompass_changes_load`
- pass `uncommitted: true` to get uncommitted changes only
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
- Set `<branch-context>` to `<ticket-summary>`

### Check Branch

- Store the current branch from `<changes>` as `<current-branch>` when available
- If `<changes>` contains no files, store `<branch-result>` as `nothing to branch from` and skip branch creation
- If `<current-branch>` starts with a conventional work category such as `feature/`, `fix/`, `refactor/`, `docs/`, `test/`, `chore/`, `feat/`, `bugfix/`, `hotfix/`, `perf/`, `build/`, or `ci/`, store `<branch-result>` as `kept <current-branch>` and skip branch creation

### Create Branch

When branch creation was not skipped:
- Choose a conventional category such as `feature`, `fix`, `refactor`, `docs`, `test`, or `chore` from the change themes and `<branch-context>`
- Generate a concise kebab-case slug from the same context
- Create and checkout `<branch-category>/<branch-slug>` with `git checkout -b`
- If that name exists, retry once with a short numeric suffix
- Store the checked-out branch as `<current-branch>` and `<branch-result>` as `created <current-branch>`
- If branch creation fails, STOP and report the blocker

### Commit Changes

- If `<changes>` contains files:
### Message Format
- Prefer this format unless the change is tiny:

```text
type: summary

- change
- change
- change
```

- Keep the subject concise and under 72 characters
- Use conventional commit format: "feat:", "fix:", "refactor:", "docs:", etc.
- For non-trivial changes, add 2-5 short bullets with the main grouped changes
- Use a one-line commit only when a body would add no value

### Commit Phase
1. Use the loaded change data as the source of truth for what will be committed
2. Stage changes with `git add` (use `-A` for all, or specific files)
3. Generate the commit message and store it as `<commit-message>`
4. Preserve the blank line between subject and bullets when present
5. Create the commit with `<commit-message>`
6. Store the created commit hash as `<hash>`
7. Only run `git status` if the commit fails and needs diagnosis
- Otherwise, continue so previously committed ticket work can still be shipped

### Load Branch Changes

- Call `kompass_changes_load` with no parameters and store the result as `<changes>`
- Store `<ticket-mode>` as `provided` when `<ticket-url>` exists, otherwise `skip`

### Check PR Blockers

- Store the current branch from `<changes>` as `<current-branch>` when available
- Store `<resolved-base>` by preferring `<base>`, otherwise use the base implied by `<changes>.comparison`
- If `<changes>.comparison` is `uncommitted`, STOP and report that changes must be committed or stashed
- If `<current-branch>` equals `<resolved-base>`, STOP and report that PR creation requires a work branch
- If `<changes>` contains no files and no commits, STOP and report that there is nothing to include in a PR

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
Implemented ticket: <ticket-summary>

Validation: <validation-results>
Branch: <current-branch>
Commit: <hash>
PR: <pr-url>

No additional steps are required.
```
