---
description: Create a branch using context from the current session
subtask: false
---

## Goal

Create and switch to a categorized branch whose name summarizes the current uncommitted work. Reuse the invoking session's change context instead of loading it again.

## Additional Context

Use `<branch-context>` to steer the branch category and slug while keeping the final name short, descriptive, and aligned with the change type.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- If `<arguments>` provides wording that should influence the branch name, store it as `<branch-context>`
- Otherwise, leave `<branch-context>` undefined

### Load Changes

- Reuse the current session's known uncommitted file set and diffs as `<changes>`
- Do not call `kompass_changes_load`; if session context is insufficient, inspect worktree status and relevant diffs to establish the complete remaining uncommitted file set without broadening scope
- Run `git branch --show-current` and store the result as `<current-branch>`

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

### Output

If there is nothing to branch from, display:
```
Nothing to branch from

No additional steps are required.
```

If branching is skipped because the current branch already looks like a work branch, display:
```
Branching skipped because the current branch already looks like a work branch.

Current branch: <current-branch>

No additional steps are required.
```

When the branch is created, display:
```
Created branch: <current-branch>

From: <starting-branch>

No additional steps are required.
```
