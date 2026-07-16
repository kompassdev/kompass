---
description: Commit current changes with a message
agent: worker
---

## Goal

Create a commit with an appropriate message summarizing the uncommitted changes.

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

#### Load Changes

- call `kompass_changes_load`
- pass `uncommitted: true` to get uncommitted changes only
- Store the returned result as `<changes>`
- If `<changes>.deferredDiffs` is present, inspect the needed deferred diffs directly one file at a time using the returned comparison and changed paths
#### Analyze And Summarize Changes

- Use `<changes>` as the source of truth; do not run additional git commands to rediscover its comparison
- Note the comparison mode, base branch, and current branch from `<changes>`
- When `<changes>.comparison` is not `uncommitted`, treat `<changes>.commits` as the authoritative scope of work: only summarize commits ahead of the resolved base branch
- Review commit messages when available to understand the delivery narrative
- Review paths, statuses, line counts, and diffs from `<changes>` as file-level context for the commits in scope
- Read only the most relevant changed source files when the diff does not provide enough context
- Identify the nature of changes (added, modified, deleted)
- Group related changes into logical themes
- Summarize the "what" and "why" (not the "how")
- Do not infer scope from branch names or describe work that exists only on the base branch or outside the commits ahead of base

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
