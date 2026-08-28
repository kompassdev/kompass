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
- Review each attachment that can change requirements, acceptance criteria, reproduction steps, design direction, or the requested answer
- Store inaccessible relevant attachments as `<attachment-gaps>`; STOP when a gap prevents a supported decision, otherwise exclude the missing material from the evidence used
- Store a concise `<ticket-summary>` and canonical `<ticket-url>` when available
- STOP if ticket context cannot be loaded

### Implement The Change

- Load the repository instructions that apply to every file likely to change
- Inspect the current implementation, its callers, and its tests until the existing behavior and local conventions are clear
- Derive `<acceptance-checks>` from every explicit requirement, constraint, and approved plan item in `<ticket-context>` and `<additional-context>`
- Store the files and behaviors intentionally excluded from this change as `<out-of-scope>`
- Implement the smallest complete change that satisfies every item in `<acceptance-checks>` while preserving unrelated work
- Before validation, account for every item in `<acceptance-checks>` with an implementation change, an existing behavior that already satisfies it, or a concrete blocker
- Continue implementing while any item remains unaccounted for; STOP and report the blocker when an item cannot be completed without changing the approved scope

### Validate Changes

- Run the most relevant available validation
- Prefer project-native checks such as changed-area tests, linting, type checking, build verification, or other documented validation steps when they exist
- If a category of validation is not available in the project, note it explicitly instead of inventing a command
- Store results as `<validation-results>` and STOP if required validation fails

### Load Uncommitted Changes Once

#### Load Changes

- Call `kompass_changes_load`
- pass `uncommitted: true` to get uncommitted changes only
- Store the returned result as `<changes>`
- If `<changes>.deferredDiffs` is present, inspect every deferred diff directly using the returned comparison and changed paths before summarizing
#### Analyze And Summarize Changes

- Use `<changes>` as the source of truth for the comparison, branches, commits, changed paths, and diffs
- For a branch comparison, limit the work scope to `<changes>.commits`; use paths and diffs to explain those commits, not to import work from the base branch
- Read a changed source file when its diff does not establish its purpose or behavioral effect
- Group the work into `<change-themes>` by delivered behavior or purpose, then store a concise "what" and "why" summary as `<change-summary>`
- Account for every changed path under one theme or identify it as generated, supporting, or non-behavioral before finishing the summary
- Base every theme on commit or diff evidence rather than the branch name
- Set `<branch-context>` to `<ticket-summary>`

### Check Branch

- Store the current branch from `<changes>` as `<current-branch>`; if unavailable, resolve it with `git branch --show-current`
- Store its initial value as `<starting-branch>`
- If `<changes>` contains no files, store `<branch-result>` as `nothing to branch from` and skip branch creation
- If `<current-branch>` starts with a conventional work category such as `feature/`, `fix/`, `refactor/`, `docs/`, `test/`, `chore/`, `feat/`, `bugfix/`, `hotfix/`, `perf/`, `build/`, or `ci/`, store `<branch-result>` as `kept <current-branch>` and skip branch creation

### Create Branch

When branch creation was not skipped:
- Choose a conventional category such as `feature`, `fix`, `refactor`, `docs`, `test`, or `chore` from the change themes and `<branch-context>`
- Generate a concise kebab-case slug from the same context
- Create and checkout `<branch-category>/<branch-slug>` with `git checkout -b`
- If that name exists, retry once with a short numeric suffix
- Confirm the checked-out branch matches the created name, then store it as `<current-branch>` and `<branch-result>` as `created <current-branch>`
- If branch creation fails, STOP and report the blocker

### Commit Changes

- If `<changes>` contains files:
#### Message Format
- Use this format when the change has more than one meaningful theme:

```text
type: summary

- grouped change
- grouped change
```

- Use a conventional type such as `feat`, `fix`, `refactor`, or `docs`, and keep the subject under 72 characters
- Add one short body bullet per meaningful change theme; use a subject-only message when there is only one self-explanatory theme

#### Commit Phase
1. Treat the file set in `<changes>` as the complete intended commit scope
2. Stage exactly that file set, including intended deletions, without staging paths outside `<changes>`
3. Compare the staged paths with `<changes>` and resolve any missing or extra path before committing
4. Generate `<commit-message>` from the loaded change themes, preserving the blank line between subject and body
5. Create the commit and store the resulting hash as `<hash>` only after it succeeds
6. If the commit fails, inspect repository status, fix the cause when safe, or STOP with the exact blocker
- Store `<commit-result>` as the created `<hash>` and `<commit-message>`
- Otherwise, store `<commit-result>` as `no new commit` and continue so previously committed ticket work can still be shipped

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

- Use `<changes>` as the source of truth for the comparison, branches, commits, changed paths, and diffs
- For a branch comparison, limit the work scope to `<changes>.commits`; use paths and diffs to explain those commits, not to import work from the base branch
- Read a changed source file when its diff does not establish its purpose or behavioral effect
- Group the work into `<change-themes>` by delivered behavior or purpose, then store a concise "what" and "why" summary as `<change-summary>`
- Account for every changed path under one theme or identify it as generated, supporting, or non-behavioral before finishing the summary
- Base every theme on commit or diff evidence rather than the branch name

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
- After a successful push, store whether commits were transferred as `<push-status>` and the reported destination as `<push-target>`
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

If any step stops on a blocker not covered by another output, store its reason as `<reason>` and completed phases as `<completed-state>`, then display:
```
Ticket development blocked: <reason>
Completed: <completed-state>

No additional steps are required.
```

When complete, display:
```
Implemented ticket: <ticket-summary>

Validation: <validation-results>
Branch: <current-branch>
Commit: <commit-result>
PR: <pr-url>

No additional steps are required.
```
