---
description: Implement a ticket and create a PR
agent: build
---

## Goal

Implement a ticket and create a pull request for the completed work.

## Workflow

### Interpret Arguments

Store `$ARGUMENTS` as `<arguments>`, then normalize it:
- Interpret `<arguments>` as `<ticket-source>` (ticket reference, URL, file path, or raw request)
- If `<arguments>` includes extra delivery guidance, scope constraints, or notes, store them as `<additional-context>`

### Load Ticket Context

- Use `ticket_load` with `<ticket-source>` to understand the requirements
- Store the result as `<ticket-context>`

### Development Flow Navigation Guide

- Orient yourself using the normalized request context before editing
- Survey the codebase before plotting the implementation
- Prefer the smallest course correction that fully reaches the destination
- Validate the path with targeted checks before handing off to PR creation
- Surface any detours or follow-up destinations that should stay off the current route

### Create PR

- Push the branch if needed
- Follow the `pr/create` workflow to generate the PR title and body
- Link the PR back to the original ticket when appropriate
- Store the resulting PR URL as `<pr-url>`

## Additional Context

Use `<additional-context>` to refine scope, sequencing, and tradeoffs while implementing `<ticket-context>`.

## Output

When the ticket work is complete, display:
```
Implemented ticket: <ticket-summary>

PR: <pr-url>
Validation:
- Compile: <status>
- Typecheck: <status>
- Test: <status>
```