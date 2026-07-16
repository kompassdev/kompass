---
description: Commit changes using context from the current session
agent: worker
subtask: false
---

## Goal

Create a commit with an appropriate message summarizing the uncommitted changes. Reuse the invoking session's change context instead of loading it again.

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

- Reuse the current session's known uncommitted changes as `<changes>`
- Do not call `kompass_changes_load`; inspect the worktree only when the session context does not identify which files remain uncommitted

### Check Blockers

- If `<changes>` contains no files, STOP and report that there is nothing to commit

### Create Commit

### Message Format
- Prefer this format unless the change is tiny:

```text
type: summary

- change
- change
- change
```

- Keep the subject concise and under 72 characters
- Use conventional commit format: "feat:", "fix:", "refactor:", "docs:", etc.
- For non-trivial changes, add 2-5 short bullets with the main grouped changes
- Use a one-line commit only when a body would add no value

### Commit Phase
1. Use the loaded change data as the source of truth for what will be committed
2. Stage changes with `git add` (use `-A` for all, or specific files)
3. Generate the commit message and store it as `<commit-message>`
4. Preserve the blank line between subject and bullets when present
5. Create the commit with `<commit-message>`
6. Store the created commit hash as `<hash>`
7. Only run `git status` if the commit fails and needs diagnosis
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
