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
- **Empty**: If no `<arguments>` are provided, proceed with defaults and rely on `changes_load` to decide the comparison mode

### Load & Analyze Changes

<%~ include("@change-summary", { rules: "- If `<base>` is defined: call `changes_load` with the `base` parameter set to `<base>`\n- Otherwise: call `changes_load` with no parameters" }) %>

- Store the loaded change result as `<changes>`

### Check Blockers

- If `<changes>` contains no files, STOP and report that there is no work to summarize in a ticket

<%~ include("@summarize-changes") %>

### Create Ticket

Use `ticket_sync` with `refUrl` unset to create the ticket:
<%~ include("@changes-summary") %>
- Set `assignees` to `[@me]` so the created ticket is assigned to yourself as the author
- Store the generated title as `<ticket-title>`
- Store the created issue URL as `<ticket-url>`

## Additional Context

Consider `<additional-context>` when analyzing the work and writing the ticket title and body.

## Output

If there is no work to summarize, display:
```
Nothing to turn into a ticket
```

When the ticket is created, display:
```
Title: `<ticket-title>`
URL: `<ticket-url>`
```
