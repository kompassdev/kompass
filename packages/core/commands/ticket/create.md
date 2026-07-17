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
- **Empty**: If no `<arguments>` are provided, proceed with defaults and rely on `<%= it.config.tools.changes_load.name %>` to decide the comparison mode

### Load & Analyze Changes

<%~ include("@change-summary", { config: it.config, rules: "- If `<base>` is defined: call `" + it.config.tools.changes_load.name + "` with the `base` parameter set to `<base>`\n- Otherwise: call `" + it.config.tools.changes_load.name + "` with no parameters" }) %>

- When `<changes>.comparison` is not `uncommitted`, describe the ticket from the commits ahead of the resolved base branch, not from branch names alone

### Check Blockers

- If `<changes>` contains no files, STOP and report that there is no work to summarize in a ticket

### Create Ticket

Use `<%= it.config.tools.ticket_sync.name %>` with `refUrl` unset to create the ticket:
<%~ include("@changes-summary", { config: it.config }) %>
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
