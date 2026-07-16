## Goal

Create a commit with an appropriate message summarizing the uncommitted changes.<% if (it.inline) { %> Reuse the invoking session's change context instead of loading it again.<% } %>

## Additional Context

Consider `<additional-context>` when analyzing changes and writing the commit message.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- If `<arguments>` provides guidance for the commit message, store it as `<additional-context>`
- Otherwise, leave `<additional-context>` undefined

### Load Changes

<% if (it.inline) { -%>
- Reuse the current session's known uncommitted changes as `<changes>`
- Do not call `<%= it.config.tools.changes_load.name %>`; inspect the worktree only when the session context does not identify which files remain uncommitted
<% } else { -%>
<%~ include("@change-summary", { config: it.config, rules: "- pass `uncommitted: true` to get uncommitted changes only" }) %>
- Store the loaded change result as `<changes>`
<% } -%>

### Check Blockers

- If `<changes>` contains no files, STOP and report that there is nothing to commit

### Create Commit

<%~ include("@commit") %>
- Store the created commit hash as `<hash>`

### Output

If there is nothing to commit, display:
```
Nothing to commit

No additional steps are required.
```

When the commit is created, display:
```
Created commit `<hash>`:

<commit-message>

No additional steps are required.
```
