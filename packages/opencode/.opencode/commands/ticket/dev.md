---
description: Implement a ticket and create a PR
agent: build
---

## Goal

Implement a ticket and create a pull request for the completed work.

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

- Use `kompass_ticket_load` with `<ticket-source>` to understand the requirements
- Store the result as `<ticket-context>`
- Store the ticket reference for PR creation as `<ticket-ref>` by preferring the original reference, otherwise using the canonical ticket URL from `<ticket-context>` when one is available, otherwise using `SKIPPED`
- Store a concise ticket summary as `<ticket-summary>`
- If `<ticket-context>` cannot be loaded, STOP and report that the ticket source is missing or invalid

### Development Flow Navigation Guide

- Orient yourself using the normalized request context before editing
- Survey the codebase before plotting the implementation
- Prefer the smallest course correction that fully reaches the destination
- Validate the path with targeted checks before handing off to PR creation
- Surface any detours or follow-up destinations that should stay off the current route

### Validate Changes

- Run the most relevant available validation for edits made in this session
- Prefer project-native checks such as changed-area tests, linting, type checking, build verification, or other documented validation steps when they exist
- If a category of validation is not available in the project, note it explicitly instead of inventing a command
- Store the collected results as `<validation-results>`

### Delegate PR Creation

- The subagent receives `<ticket-ref>`, `<ticket-context>`, and `<additional-context>`
- Define `<prompt>` as:

<prompt>
/pr/create

Ticket reference: <ticket-ref>
Ticket context: <ticket-context>
Additional context: <additional-context>
</prompt>

- Call subagent `@general` with `<prompt>`
- Do not paraphrase or prepend extra text
- Store the subagent result as `<pr-result>`
- If `<pr-result>` is blocked or incomplete, STOP and report the PR blocker
- Otherwise, continue and store the resulting PR URL as `<pr-url>`

## Additional Context

Use `<additional-context>` to refine scope, sequencing, and tradeoffs while implementing `<ticket-context>`.

## Output

When the ticket work is complete, display:
```
Implemented ticket: <ticket-summary>

PR: <pr-url>
Validation:
<validation-results>
```