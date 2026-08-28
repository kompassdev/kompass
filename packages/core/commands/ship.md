## Goal

Ship the current work through branch creation, commit creation, and PR creation in one workflow.<% if (it.inline) { %> Reuse the invoking session's change context for the initial branch and commit phases.<% } %>

## Additional Context

Use `<branch-context>` for branch naming and `<additional-context>` for commit and PR summaries. Reuse loaded state within this command instead of reloading it between phases.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- Initialize `<base>`, `<branch-context>`, and `<additional-context>` as empty
- If `<arguments>` is only a branch reference, store it as `<base>`
- Otherwise, store it as both `<branch-context>` and `<additional-context>`

### Load Uncommitted Changes Once

<% if (it.inline) { -%>
- Reuse the current session's known uncommitted changes as `<changes>` for branch naming and commit creation
- Do not call `<%= it.config.tools.changes_load.name %>` before the branch and commit phases; inspect the worktree only when the session context does not identify which files remain uncommitted
<% } else { -%>
<%~ include("@change-summary", { config: it.config, rules: "- pass `uncommitted: true` to get uncommitted changes only" }) %>
- Reuse `<changes>` for branch naming and commit creation
<% } -%>

<%~ include("@branch") %>

### Create Commit

- If `<changes>` contains files, create the commit from the already loaded `<changes>`:
<%~ include("@commit") %>
- Store `<commit-result>` as the created hash and message
- If `<changes>` contains no files, store `<commit-result>` as `no new commit`

### Load Branch Changes

- Call `<%= it.config.tools.changes_load.name %>` with `base: <base>` when defined, otherwise with no arguments
- Store the new result as `<changes>`; this post-commit comparison is required for PR creation

<%~ include("@pr-create", { config: it.config }) %>

### Output

If any step stops on a blocker not covered by another output, store its reason as `<reason>` and completed phases as `<completed-state>`, then display:
```
Ship blocked: <reason>
Completed: <completed-state>

No additional steps are required.
```

When complete, display:
```
Ship flow complete

Branch: <branch-result>
Commit: <commit-result>
PR: <pr-url>

No additional steps are required.
```
