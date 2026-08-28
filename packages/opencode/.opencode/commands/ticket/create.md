---
description: Summarize current change comparison and create a ticket
agent: worker
---

## Goal

Create a ticket that summarizes the work returned by the current change comparison.

## Additional Context

Consider `<additional-context>` when analyzing the work and writing the ticket title and body.

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

#### Load Changes

- Call `kompass_changes_load`
- If `<base>` is defined: call `kompass_changes_load` with the `base` parameter set to `<base>`
- Otherwise: call `kompass_changes_load` with no parameters
- Store the returned result as `<changes>`
- If `<changes>.deferredDiffs` is present, inspect every deferred diff directly using the returned comparison and changed paths before summarizing
#### Analyze And Summarize Changes

- Use `<changes>` as the source of truth for the comparison, branches, commits, changed paths, and diffs
- For a branch comparison, limit the work scope to `<changes>.commits`; use paths and diffs to explain those commits, not to import work from the base branch
- Read a changed source file when its diff does not establish its purpose or behavioral effect
- Group the work into `<change-themes>` by delivered behavior or purpose, then store a concise "what" and "why" summary as `<change-summary>`
- Account for every changed path under one theme or identify it as generated, supporting, or non-behavioral before finishing the summary
- Base every theme on commit or diff evidence rather than the branch name

- When `<changes>.comparison` is not `uncommitted`, describe the ticket from the commits ahead of the resolved base branch, not from branch names alone

### Check Blockers

- If `<changes>` contains no files, STOP and report that there is no work to summarize in a ticket

### Create Ticket

Use `kompass_ticket_sync` with `refUrl` unset to create the ticket:
- Reuse the same change themes, rationale, and reviewer-facing validation goals from the current summary work
- For branch comparisons, ensure every theme is supported by commits in `<changes>.commits`; use file diffs only as supporting context
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

### Output

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
