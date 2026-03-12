---
description: Commit and push current changes
agent: build
---

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

#### Step 1: Load Changes
- call `kompass_changes_load`
- pass `uncommitted: true` to get uncommitted changes only
- Store the returned result as `<changes>`
- Use `<changes>` as the source of truth; no additional git analysis commands are needed

#### Step 2: Analyze Files
- Review the paths, statuses, and diffs from `<changes>`
- Identify the nature of changes (added, modified, deleted)
- Note lines added/removed per file

#### Step 3: Group and Summarize
- Group related changes into logical themes
- Summarize the "what" and "why" (not the "how")
- Store the loaded change result as `<changes>`

### Check Blockers

- If `<changes>` contains no files, STOP and report that there is nothing to commit or push

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