---
description: Summarize completed work and create a ticket
agent: build
---

## Goal

Create a GitHub ticket that summarizes the work completed in the current branch or working tree.

## Workflow

### Interpret Arguments

Store `$ARGUMENTS` as `<arguments>`, then analyze it to determine how to proceed:
- **Branch name**: If `<arguments>` looks like a branch reference (e.g., "main", "origin/develop"), store it as `<base>`
- **Additional context**: If `<arguments>` provides guidance (audience, focus areas, related issues, notes), store it as `<additional-context>`
- **Empty**: If no `<arguments>` are provided, proceed with defaults

### Load & Analyze Changes

#### Step 1: Load Changes
- call `kompass_changes_load`
- If `<base>` is defined: call `kompass_changes_load` with the `base` parameter set to `<base>`
- Otherwise: call `kompass_changes_load` with no parameters
- Use `kompass_changes_load` as the source of truth; no additional git analysis commands are needed

#### Step 2: Analyze Files
- Review the paths, statuses, and diffs from `kompass_changes_load`
- Identify the nature of changes (added, modified, deleted)
- Note lines added/removed per file

#### Step 3: Group and Summarize
- Group related changes into logical themes
- Summarize the "what" and "why" (not the "how")

### Summarize Changes

- Note the comparison mode, base branch, and current branch from the result
- Review commit messages when they are available to understand the delivery narrative
- Read the most relevant changed source files to understand the changes
- Group related changes into themes for the final summary

### Create Ticket

Use `kompass_ticket_create` to open the GitHub issue:
- Generate a concise title (max 70 chars) that reflects the delivered outcome
- Generate a body with:
  - `## Summary` - 1-3 bullets focused on what was accomplished and why it matters
  - `## Validation` - concrete validation steps or `No validation performed`
- Keep the body compact and directional
- Do not restate the full diff
- If the work is uncommitted, make that clear in the ticket wording
- Store the created issue reference or URL as `<ticket-ref>`

## Additional Context

Consider `<additional-context>` when analyzing the work and writing the ticket title and body.

## Output

When the ticket is created, display:
```
Created ticket: <title>

Ticket: <ticket-ref>
```