## Goal

Create and switch to a categorized branch whose name summarizes the current uncommitted work.<% if (it.inline) { %> Reuse the invoking session's change context instead of loading it again.<% } %>

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

<% if (it.inline) { -%>
- Reuse the current session's known uncommitted file set and diffs as `<changes>`
- Do not call `<%= it.config.tools.changes_load.name %>`; if session context is insufficient, inspect worktree status and relevant diffs to establish the complete remaining uncommitted file set without broadening scope
- Run `git branch --show-current` and store the result as `<current-branch>`
<% } else { -%>
<%~ include("@change-summary", { config: it.config, rules: "- pass `uncommitted: true` to get uncommitted changes only" }) %>
- Store the current branch as `<current-branch>` when it is available
<% } -%>

<%~ include("@branch") %>

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
