## Goal

Create a scoped implementation plan from a request or ticket, then capture that plan in the relevant ticket flow without losing important technical context.

## Additional Context

Use `<additional-context>` to prioritize constraints, dependencies, and focus areas. Update a provided ticket in place; create a ticket only when the source is a request rather than an existing ticket.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

<%~ include("@ticket-planning", { config: it.config }) %>

### Sync Ticket

- Use `<%= it.config.tools.ticket_sync.name %>` to store the plan in the ticket flow:
  - set `title` to `<plan-title>`
  - set `description` to `<plan-description>`
  - set `checklists` to two sections:
    - `Implementation` with `<requirement-items>`
    - `Validation` with `<validation-items>`
  - set `refUrl` to `<ticket-url>` when updating an existing ticket
  - leave `refUrl` unset when creating a new ticket from the request
- Store the returned ticket URL as `<ticket-url>`

### Present Plan

- Return the generated title, a brief plan summary, and the ticket reference or URL
- Call out assumptions, risks, or blockers only when they materially matter

### Output

If planning context cannot be determined, display:
```
Unable to plan: missing request or ticket context

No additional steps are required.
```

When the plan is ready, display:
```text
Title: `<plan-title>`
URL: `<ticket-url>`

Plan:
<plan-description>

## Implementation
- <requirement-item>

## Validation
- <validation-item>

No additional steps are required.
```
