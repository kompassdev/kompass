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

<%~ include("@change-summary", { rules: "- pass `uncommitted: true` to get uncommitted changes only" }) %>
- Store the loaded change result as `<changes>`
- Store the current branch as `<current-branch>` when it is available

### Check Blockers

- If `<changes>` contains no files, STOP and report that there is nothing to branch from
- If `<current-branch>` already starts with a conventional work-branch category such as `feature/`, `fix/`, `refactor/`, `docs/`, `test/`, `chore/`, `feat/`, `bugfix/`, `hotfix/`, `perf/`, `build/`, or `ci/`, STOP and report that branching is being skipped because the current branch already looks like a work branch

### Create Branch

- Choose a branch category from the summarized change themes and `<branch-context>`
- Prefer conventional categories such as `feature`, `fix`, `refactor`, `docs`, `test`, or `chore`
- Store the chosen category as `<branch-category>`
- Generate a concise kebab-case slug from the summarized change themes and `<branch-context>` when available, then store it as `<branch-slug>`
- Create and checkout `<branch-category>/<branch-slug>` with `git checkout -b`
- If that name already exists, retry once with a short numeric suffix
- Store the checked-out branch as `<new-branch>`

### Output

If there is nothing to branch from, display:
```
Nothing to branch from

No additional steps are required.
```

If branching is skipped because the current branch already looks like a work branch, display:
```
Already on work branch: <current-branch>

No additional steps are required.
```

When the branch is created, display:
```
Created branch: <new-branch>

From: <current-branch>

No additional steps are required.
```
