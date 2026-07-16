## Goal

Create a commit and immediately push it to the remote repository.<% if (it.inline) { %> Reuse the invoking session's change context instead of loading it again.<% } %>

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
- Reuse the current session's known uncommitted file set and diffs as `<changes>`
- Do not call `<%= it.config.tools.changes_load.name %>`; if session context is insufficient, inspect worktree status and relevant diffs to establish the complete remaining uncommitted file set without broadening scope
<% } else { -%>
<%~ include("@change-summary", { config: it.config, rules: "- pass `uncommitted: true` to get uncommitted changes only" }) %>
<% } -%>

### Check Blockers

- If `<changes>` contains no files, STOP and report that there is nothing to commit or push

### Create Commit

<%~ include("@commit") %>

### Push to Remote

<%~ include("@push", { config: it.config }) %>

### Output

If there is nothing to commit, display:
```
Nothing to commit or push

No additional steps are required.
```

When complete, display:
```
Created commit `<hash>`:

<commit-message>

Pushed to <push-target>

No additional steps are required.
```
