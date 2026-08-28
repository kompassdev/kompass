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

### Implement The Change

- Load the repository instructions that apply to every file likely to change
- Inspect the current implementation, its callers, and its tests until the existing behavior and local conventions are clear
- Derive `<acceptance-checks>` from every explicit requirement, constraint, and approved plan item in `<task>`, `<task-context>`, `<plan>`, and `<additional-context>`
- Store the files and behaviors intentionally excluded from this change as `<out-of-scope>`
- Implement the smallest complete change that satisfies every item in `<acceptance-checks>` while preserving unrelated work
- Before validation, account for every item in `<acceptance-checks>` with an implementation change, an existing behavior that already satisfies it, or a concrete blocker
- Continue implementing while any item remains unaccounted for; STOP and report the blocker when an item cannot be completed without changing the approved scope

### Validate Task

- Run relevant validation and STOP without marking complete if implementation or validation is incomplete

### Load And Commit Task Changes

#### Load Changes

- Call `kompass_changes_load`
- pass `uncommitted: true` to get uncommitted changes only
- Store the returned result as `<changes>`
- If `<changes>.deferredDiffs` is present, inspect every deferred diff directly using the returned comparison and changed paths before summarizing
#### Analyze And Summarize Changes

- Use `<changes>` as the source of truth for the comparison, branches, commits, changed paths, and diffs
- For a branch comparison, limit the work scope to `<changes>.commits`; use paths and diffs to explain those commits, not to import work from the base branch
- Read a changed source file when its diff does not establish its purpose or behavioral effect
- Group the work into `<change-themes>` by delivered behavior or purpose, then store a concise "what" and "why" summary as `<change-summary>`
- Account for every changed path under one theme or identify it as generated, supporting, or non-behavioral before finishing the summary
- Base every theme on commit or diff evidence rather than the branch name
- STOP without marking complete if `<changes>` contains no files
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
