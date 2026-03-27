---
description: Implement a request and prepare it for PR creation
agent: navigator
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
- Review attached images, PDFs, and other linked files whenever they can affect requirements, acceptance criteria, reproduction steps, design direction, or the requested answer
- If any relevant attachment cannot be accessed, note that gap and continue only when the remaining ticket context is still sufficient to proceed reliably
- Otherwise, treat `<request>` as `<request-context>`
- If `<request-context>` cannot be determined, STOP and report that the implementation request is missing

### Orient Request

- Summarize the goal, constraints, and acceptance criteria from `<request-context>` before making changes
- Store that summary as `<request-summary>`

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

### Prepare PR Handoff

- Gather the key themes, tradeoffs, and validation results needed for the PR description
- Store that handoff material as `<pr-handoff>`
- Store the current branch name as `<branch>`
- Do not create the pull request in this command; stop when the branch is ready for `pr/create`

### Output

When the implementation is ready for PR creation, display:
```
Implementation ready: <request-summary>

Validation:
<validation-results>

Ready for PR creation on <branch>

No additional steps are required.
```
