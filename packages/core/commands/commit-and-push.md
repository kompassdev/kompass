## Goal

Create a commit and immediately push it to the remote repository.

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

- If `<changes>` contains no files, STOP and report that there is nothing to commit or push

### Create Commit

<%~ include("@commit") %>
- Store the created commit hash as `<hash>`

### Push to Remote

- Run `git push` and use its output as the source of truth
- If the current branch has no upstream set, retry with `git push -u origin <branch>`
- Store the successful destination as `<push-target>`
- If push fails, STOP and report the push error

## Additional Context

Consider `<additional-context>` when analyzing changes and writing the commit message.

## Output

If there is nothing to commit, display:
```
Nothing to commit or push
```

When complete, display:
```
Created commit `<hash>`:

<commit-message>

Pushed to <push-target>
```
