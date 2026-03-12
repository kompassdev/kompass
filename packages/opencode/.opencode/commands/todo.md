---
description: Work through a todo file task by task
agent: navigator
---

## Goal

Work through a todo file one pending item at a time by planning, getting approval, implementing, committing, and marking completed tasks.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- If `<arguments>` contains a file reference prefixed with `@`, store that value as `<todo-file>`
- If `<arguments>` includes execution guidance, scope constraints, or notes beyond the file reference, store them as `<additional-context>`
- If no file reference is provided, default `<todo-file>` to `@TODO.md`

### Load Todo Context

- Prefer the file content already provided by the user's file mention or attachment for `<todo-file>`
- Only load `<todo-file>` yourself if that content is not already available in context
- If the file cannot be loaded, STOP and report that `<todo-file>` could not be found or read
- Treat markdown checklist items with unchecked boxes as pending tasks, preserving file order
- Ignore headings, checked items, and non-checklist lines when selecting work
- If there are no pending tasks, STOP and report that `<todo-file>` has no remaining work
- Store the first pending task text as `<task>`
- Store any nearby checklist context that materially clarifies `<task>` as `<task-context>`

### Check Blockers

- If the first pending item is unclear, let the planner identify missing details or questions when it can do so safely from `<task-context>` and `<additional-context>`
- Only STOP here when the task is too ambiguous to plan at all and the workflow cannot produce a meaningful plan or targeted clarification request

### Delegate Planning

- The subagent receives `<task>`, `<task-context>`, and `<additional-context>`
- Define `<prompt-plan>` as:

<prompt-plan>
/ticket/plan

Task: <task>
Task context: <task-context>
Additional context: <additional-context>
</prompt-plan>

- Call subagent `@planner` with `<prompt-plan>`
- Do not paraphrase or prepend extra text
- Ask the planner for a concise implementation plan with clear scope, risks, and validation steps
- Store the result as `<plan>`
- If the planner is blocked or cannot produce a usable plan, store the blocker as `<pause-reason>`, then STOP and report that planning blocker

### Review Plan With User

- Show `<task>` and `<plan>` to the user before any implementation work starts
- Ask one `question` with:
  - header `Plan Review`
  - question `Does this plan look good to implement?`
  - options:
    - `Implement` - proceed with the current plan
    - `Revise` - update the plan based on feedback
- custom answers enabled so the user can provide specific plan changes
- If the user requests changes, store that feedback as `<user-answer>`
- The subagent receives `<task>`, `<task-context>`, `<plan>`, `<user-answer>`, and `<additional-context>`
- Define `<prompt-revise>` as:

<prompt-revise>
/ticket/plan

Task: <task>
Task context: <task-context>
Current plan: <plan>
Plan feedback: <user-answer>
Additional context: <additional-context>
</prompt-revise>

- Call subagent `@planner` with `<prompt-revise>`
- Do not paraphrase or prepend extra text
- Store the revised result as `<plan>` and continue the review loop
- If the revised planner result is blocked or unusable, store that blocker as `<pause-reason>`, then STOP and report it before continuing the review loop
- Repeat this review step until the user approves or stops
- If the user does not approve implementation, store `plan approval not granted` as `<pause-reason>`, then STOP without changing `<todo-file>`

### Delegate Implementation

- The subagent receives `<plan>`, `<task>`, `<task-context>`, and `<additional-context>`
- Define `<prompt-dev>` as:

<prompt-dev>
/dev

Plan: <plan>
Task: <task>
Task context: <task-context>
Additional context: <additional-context>
</prompt-dev>

- Call subagent `@general` with `<prompt-dev>`
- Do not paraphrase or prepend extra text
- Store the subagent result as `<implementation-result>`
- If `<implementation-result>` is incomplete, blocked, or fails validation, store the issue as `<pause-reason>`, then STOP and report it without marking the task complete

### Delegate Commit

- The subagent receives `<task>` and `<additional-context>`
- Define `<prompt-commit>` as:

<prompt-commit>
/commit

Task: <task>
Additional context: <additional-context>
</prompt-commit>

- Call subagent `@general` with `<prompt-commit>`
- Do not paraphrase or prepend extra text
- Store the subagent result as `<commit-result>`
- If `<commit-result>` does not succeed, store the commit status as `<pause-reason>`, then STOP and report it without marking the task complete

### Mark Complete And Loop

- After the implementation and commit both succeed, update the matching checklist item in `<todo-file>` from unchecked to checked while preserving the rest of the file
- Save the updated todo file
- Return to `### Load Todo Context` and repeat the workflow for the next pending task

## Additional Context

- Keep the loop focused on one checklist item at a time
- Do not merge separate todo items unless the file explicitly frames them as one task
- If implementation reveals scope that materially changes the approved plan, pause and re-plan before marking the task complete
- Use `<additional-context>` to prioritize tradeoffs, constraints, or validation expectations during planning and implementation

## Output

When presenting a task plan for approval, display:
```
Todo: <todo-file>
Task: <task>

Plan:
<plan>
```

If the workflow pauses before marking the task complete, display:
```
Todo paused: <todo-file>
Task: <task>
Reason: <pause-reason>
```

When all pending tasks are complete, display:
```
Todo complete: <todo-file>
Remaining: 0
```