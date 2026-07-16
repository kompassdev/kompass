---
description: Work through a todo file task by task
agent: worker
---

## Goal

Work through a todo file one pending item at a time by planning, getting approval, implementing, committing, and marking it complete.

## Additional Context

- Keep the loop focused on one checklist item at a time
- Pause and revise the plan when implementation materially changes approved scope
- Use `<additional-context>` for constraints and validation expectations

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- Store an `@`-prefixed file as `<todo-file>` and remaining guidance as `<additional-context>`
- Default `<todo-file>` to `@TODO.md`

### Load Next Todo

- Prefer attached content, otherwise load `<todo-file>`
- Select the first unchecked markdown checklist item as `<task>` and preserve nearby context as `<task-context>`
- STOP with completion when no pending tasks remain

### Plan Task

- Inspect relevant repository context and shape a scoped implementation plan from `<task>`, `<task-context>`, and `<additional-context>`
- Store it as `<plan>`
- Show the plan and ask one `Plan Review` question with `Implement` and `Revise`, with custom answers enabled
- Apply revision feedback and repeat until approved; STOP without editing when approval is not granted

### Implement Task

### Development Flow Navigation Guide

- Orient yourself using the normalized request context before editing
- Survey the codebase before plotting the implementation
- Prefer the smallest course correction that fully reaches the destination
- Validate the path with targeted checks before handing off to PR creation
- Surface any detours or follow-up destinations that should stay off the current route
- Implement the approved `<plan>`
- Run relevant validation and STOP without marking complete if implementation or validation is incomplete

### Load And Commit Task Changes

#### Step 1: Load Changes
- call `kompass_changes_load`
- pass `uncommitted: true` to get uncommitted changes only
- Store the returned result as `<changes>`
- Use `<changes>` as the source of truth; no additional git analysis commands are needed
- When `<changes>.comparison` is not `uncommitted`, treat `<changes>.commits` as the authoritative scope of work: only summarize commits that are ahead of the resolved base branch
- Do not infer scope from the branch names alone and do not describe work that exists only on the base branch

#### Step 2: Analyze Files
- Review the paths, statuses, and diffs from `<changes>` only as file-level context for the commits in scope
- Identify the nature of changes (added, modified, deleted)
- Note lines added/removed per file

#### Step 3: Group and Summarize
- For branch comparisons, build the summary from `<changes>.commits` first and use file diffs only to verify or refine what those commits changed
- Group related changes into logical themes
- Summarize the "what" and "why" (not the "how")
- STOP without marking complete if `<changes>` contains no files
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

### Mark Complete And Loop

- After commit succeeds, change the matching checklist item to checked while preserving the file
- Return to `### Load Next Todo`

### Output

When all pending tasks are complete, display:
```
Todo complete: <todo-file>
Remaining: 0

No additional steps are required.
```
