---
description: Implement a request and prepare it for PR creation
agent: worker
---

## Goal

Implement a feature or fix based on a ticket or request, then prepare for PR creation.

## Additional Context

Use `<additional-context>` to refine priorities, scope, and tradeoffs while implementing `<request-context>`.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- If `<arguments>` looks like a ticket reference, URL, or file path, store it as `<request-source>`
- If `<arguments>` contains direct implementation guidance, store it as `<request>`
- If `<arguments>` includes extra constraints, focus areas, or notes, store them as `<additional-context>`
- If empty, derive the request from the conversation

### Load Request Context

- If `<request-source>` is defined:
- Use `kompass_ticket_load` with `source: <request-source>`
- Store the result as `<request-context>`
- Treat the loaded ticket body, discussion, and any attachments or linked artifacts returned by the loader as part of the source context
- Review each attachment that can change requirements, acceptance criteria, reproduction steps, design direction, or the requested answer
- Store inaccessible relevant attachments as `<attachment-gaps>`; STOP when a gap prevents a supported decision, otherwise exclude the missing material from the evidence used
- Otherwise, treat `<request>` as `<request-context>`
- If `<request-context>` cannot be determined, STOP and report that the implementation request is missing

### Orient Request

- Summarize the goal, constraints, and acceptance criteria from `<request-context>` before making changes
- Store that summary as `<request-summary>`

### Implement The Change

- Load the repository instructions that apply to every file likely to change
- Inspect the current implementation, its callers, and its tests until the existing behavior and local conventions are clear
- Derive `<acceptance-checks>` from every explicit requirement, constraint, and approved plan item in `<request-context>`, `<request-summary>`, and `<additional-context>`
- Store the files and behaviors intentionally excluded from this change as `<out-of-scope>`
- Implement the smallest complete change that satisfies every item in `<acceptance-checks>` while preserving unrelated work
- Before validation, account for every item in `<acceptance-checks>` with an implementation change, an existing behavior that already satisfies it, or a concrete blocker
- Continue implementing while any item remains unaccounted for; STOP and report the blocker when an item cannot be completed without changing the approved scope

### Validate Changes

- Run the most relevant available validation for edits made in this session
- Prefer project-native checks such as changed-area tests, linting, type checking, build verification, or other documented validation steps when they exist
- If a category of validation is not available in the project, note it explicitly instead of inventing a command
- Store the collected results as `<validation-results>`

### Prepare PR Handoff

- Gather the key themes, tradeoffs, and validation results needed for the PR description
- Store that handoff material as `<pr-handoff>`
- Store the current branch name as `<branch>`
- Do not create the pull request in this command; stop when the branch is ready for `pr/create`

### Output

If any step stops on a blocker not covered by another output, store its reason as `<reason>` and completed phases as `<completed-state>`, then display:
```
Implementation blocked: <reason>
Completed: <completed-state>

No additional steps are required.
```

When the implementation is ready for PR creation, display:
```
Implementation ready: <request-summary>

Validation:
<validation-results>

Ready for PR creation on <branch>

No additional steps are required.
```
