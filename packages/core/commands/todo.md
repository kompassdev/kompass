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

<%~ include("@dev-flow", { context: "`<task>`, `<task-context>`, `<plan>`, and `<additional-context>`" }) %>

### Validate Task

- Run relevant validation and STOP without marking complete if implementation or validation is incomplete

### Load And Commit Task Changes

<%~ include("@change-summary", { config: it.config, rules: "- pass `uncommitted: true` to get uncommitted changes only" }) %>
- STOP without marking complete if `<changes>` contains no files
<%~ include("@commit") %>

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
