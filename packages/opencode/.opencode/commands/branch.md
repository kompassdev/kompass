---
description: Create a feature branch from current changes
agent: worker
---

## Goal

Create and switch to a categorized branch whose name summarizes the current uncommitted work.

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

#### Step 1: Load Changes
- call `kompass_changes_load`
- pass `uncommitted: true` to get uncommitted changes only
- Store the returned result as `<changes>`
- Use `<changes>` as the source of truth; no additional git analysis commands are needed
- When `<changes>.comparison` is not `uncommitted`, treat `<changes>.commits` as the authoritative scope of work: only summarize commits that are ahead of the resolved base branch
- Do not infer scope from the branch names alone and do not describe work that exists only on the base branch

#### Step 2: Analyze Files
- Review the paths, statuses, and diffs from `<changes>` only as file-level context for the commits in scope
- Identify the nature of changes (added, modified, deleted)
- Note lines added/removed per file

#### Step 3: Group and Summarize
- For branch comparisons, build the summary from `<changes>.commits` first and use file diffs only to verify or refine what those commits changed
- Group related changes into logical themes
- Summarize the "what" and "why" (not the "how")
- Store the loaded change result as `<changes>`
- Store the current branch as `<current-branch>` when it is available

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

From: <current-branch>

No additional steps are required.
```
