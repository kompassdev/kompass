---
description: Commit and push using context from the current session
subtask: false
---

## Goal

Create a commit and immediately push it to the remote repository. Reuse the invoking session's change context instead of loading it again.

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

- Reuse the current session's known uncommitted file set and diffs as `<changes>`
- Do not call `kompass_changes_load`; if session context is insufficient, inspect worktree status and relevant diffs to establish the complete remaining uncommitted file set without broadening scope

### Check Blockers

- If `<changes>` contains no files, STOP and report that there is nothing to commit or push

### Create Commit

#### Message Format
- Use this format when the change has more than one meaningful theme:

```text
type: summary

- grouped change
- grouped change
```

- Use a conventional type such as `feat`, `fix`, `refactor`, or `docs`, and keep the subject under 72 characters
- Add one short body bullet per meaningful change theme; use a subject-only message when there is only one self-explanatory theme

#### Commit Phase
1. Treat the file set in `<changes>` as the complete intended commit scope
2. Stage exactly that file set, including intended deletions, without staging paths outside `<changes>`
3. Compare the staged paths with `<changes>` and resolve any missing or extra path before committing
4. Generate `<commit-message>` from the loaded change themes, preserving the blank line between subject and body
5. Create the commit and store the resulting hash as `<hash>` only after it succeeds
6. If the commit fails, inspect repository status, fix the cause when safe, or STOP with the exact blocker

### Push Branch

- If `<current-branch>` is not defined, run `git branch --show-current` and store the trimmed result as `<current-branch>`
- Run `git push` and use its output as the source of truth
- If the current branch has no upstream, retry with `git push -u origin <current-branch>`
- After a successful push, store whether commits were transferred as `<push-status>` and the reported destination as `<push-target>`
- If push fails, STOP and report the push error

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
