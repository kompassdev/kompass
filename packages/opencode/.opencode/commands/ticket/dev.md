---
description: Implement a ticket and create a PR
agent: build
---

## Goal

Implement a ticket by orchestrating development, branching, commit-and-push, and PR creation.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- Interpret `<arguments>` as `<ticket-source>` (ticket reference, URL, file path, or raw request)
- If `<arguments>` includes extra delivery guidance, scope constraints, or notes, store them as `<additional-context>`
- If `<ticket-source>` is empty, derive it from the conversation before continuing

### Load Ticket Context

- Use `kompass_ticket_load` with `source: <ticket-source>`
- Store the result as `<ticket-context>`
- Treat the loaded ticket body, discussion, and any attachments or linked artifacts returned by the loader as part of the source context
- Review attached images, PDFs, and other linked files whenever they can affect requirements, acceptance criteria, reproduction steps, design direction, or the requested answer
- If any relevant attachment cannot be accessed, note that gap and continue only when the remaining ticket context is still sufficient to proceed reliably
- Store the ticket reference for PR creation as `<ticket-ref>` by preferring the original reference, otherwise using the canonical ticket URL from `<ticket-context>` when one is available, otherwise using `SKIPPED`
- Store a concise ticket summary as `<ticket-summary>`
- If `<ticket-context>` cannot be loaded, STOP and report that the ticket source is missing or invalid

### Development Flow Navigation Guide

- Orient yourself using the normalized request context before editing
- Survey the codebase before plotting the implementation
- Prefer the smallest course correction that fully reaches the destination
- Validate the path with targeted checks before handing off to PR creation
- Surface any detours or follow-up destinations that should stay off the current route

### Delegate Implementation

- Before delegating, send the exact task block below

<task agent="general" command="/dev">
Ticket reference: <ticket-ref>
Ticket context: <ticket-context>
Additional context: <additional-context>
</task>

- Store the result as `<implementation-result>`
- If `<implementation-result>` is blocked or incomplete, STOP and report the implementation blocker

### Delegate Branch Creation

- Before delegating, send the exact task block below

<task agent="general" command="/branch">
Branch naming guidance: <ticket-summary>
Additional context: <additional-context>
</task>

- Store the result as `<branch-result>`
- If `<branch-result>` is blocked or incomplete, STOP and report the branch blocker
- If `<branch-result>` says branching was skipped because the current branch already looks like a work branch, continue

### Delegate Commit And Push

- Before delegating, send the exact task block below

<task agent="general" command="/commit-and-push">
Ticket reference: <ticket-ref>
Ticket summary: <ticket-summary>
Additional context: <additional-context>
</task>

- Store the result as `<commit-result>`
- If `<commit-result>` is blocked or incomplete, STOP and report the commit or push blocker
- If `<commit-result>` says there was nothing to commit or push, continue to PR creation so already-committed branch work can still be shipped

### Delegate PR Creation

- Before delegating, send the exact task block below

<task agent="general" command="/pr/create">
Ticket reference: <ticket-ref>
Ticket context: <ticket-context>
Additional context: <additional-context>
</task>

- Store the result as `<pr-result>`
- If `<pr-result>` is blocked or incomplete, STOP and report the PR blocker
- Otherwise, continue and store the resulting PR URL as `<pr-url>`

## Additional Context

Use `<additional-context>` to refine scope, sequencing, and tradeoffs across the delegated `/dev`, `/branch`, `/commit-and-push`, and `/pr/create` steps.

## Output

When the ticket work is complete, display:
```
Implemented ticket: <ticket-summary>

Implementation: <implementation-result>
Branch: <branch-result>
Commit and push: <commit-result>
PR: <pr-url>

No additional steps are required.
```