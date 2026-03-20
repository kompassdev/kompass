---
description: Summarize completed work and create a ticket
agent: build
---

## Goal

Create a ticket that summarizes the work returned by the current change comparison.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- **Branch name**: If `<arguments>` looks like a branch reference (e.g., "main", "origin/develop"), store it as `<base>`
- **Additional context**: If `<arguments>` provides guidance (audience, focus areas, related issues, notes), store it as `<additional-context>`
- **Empty**: If no `<arguments>` are provided, proceed with defaults and rely on `kompass_changes_load` to decide the comparison mode

### Load & Analyze Changes

#### Step 1: Load Changes
- call `kompass_changes_load`
- If `<base>` is defined: call `kompass_changes_load` with the `base` parameter set to `<base>`
- Otherwise: call `kompass_changes_load` with no parameters
- Store the returned result as `<changes>`
- Use `<changes>` as the source of truth; no additional git analysis commands are needed

#### Step 2: Analyze Files
- Review the paths, statuses, and diffs from `<changes>`
- Identify the nature of changes (added, modified, deleted)
- Note lines added/removed per file

#### Step 3: Group and Summarize
- Group related changes into logical themes
- Summarize the "what" and "why" (not the "how")

- Store the loaded change result as `<changes>`

### Check Blockers

- If `<changes>` contains no files, STOP and report that there is no work to summarize in a ticket

### Summarize Changes

- Note the comparison mode, base branch, and current branch from the result
- Review commit messages when they are available to understand the delivery narrative
- Read the most relevant changed source files to understand the changes
- Group related changes into themes for the final summary

### Create Ticket

Use `kompass_ticket_sync` with `refUrl` unset to create the ticket:
- Reuse the same change themes, rationale, and reviewer-facing validation goals from the current summary work
- Generate a concise title (max 70 chars) that reflects the delivered outcome
- Generate a `description` that briefly describes what was accomplished and why it matters
- Generate checklists with:
  - 2-4 functional sections named after user-facing areas or outcomes, not generic labels like `Changes`
  - concise, outcome-focused items under each section that describe what changed for a human reader
  - one final `Validation` section with reviewer-facing confirmation steps that start with `Verify that...`, `Confirm that...`, or `Check that...`
- Keep section names and items concise, human-friendly, and function-oriented
- Merge tiny themes together instead of creating a section per file or implementation detail
- Do not restate the full diff
- Do not use execution-status notes such as `Validation not run in this session` as checklist items
- If `kompass_changes_load` reports uncommitted work, make that clear in the ticket wording
- Set `assignees` to `[@me]` so the created ticket is assigned to yourself as the author
- Store the generated title as `<ticket-title>`
- Store the created issue URL as `<ticket-url>`

## Additional Context

Consider `<additional-context>` when analyzing the work and writing the ticket title and body.

## Output

If there is no work to summarize, display:
```
Nothing to turn into a ticket

No additional steps are required.
```

When the ticket is created, display:
```
Title: `<ticket-title>`
URL: `<ticket-url>`

No additional steps are required.
```