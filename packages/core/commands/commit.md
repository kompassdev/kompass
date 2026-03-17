## Goal

Create a commit with an appropriate message summarizing the uncommitted changes.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- If `<arguments>` provides guidance for the commit message, store it as `<additional-context>`
- Otherwise, leave `<additional-context>` undefined

### Load Changes

<%~ include("@change-summary", { rules: "- pass `uncommitted: true` to get uncommitted changes only" }) %>
- Store the loaded change result as `<changes>`

### Check Blockers

- If `<changes>` contains no files, STOP and report that there is nothing to commit

### Create Commit

<%~ include("@commit") %>
- Store the created commit hash as `<hash>`

## Additional Context

Consider `<additional-context>` when analyzing changes and writing the commit message.

## Output

If there is nothing to commit, display:
```
Nothing to commit
```

When the commit is created, display:
```
Created commit `<hash>`:

<commit-message>
```
