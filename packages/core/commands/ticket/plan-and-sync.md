## Goal

Create a scoped implementation plan from a request or ticket, then capture that plan in the relevant ticket flow without losing important technical context.

## Additional Context

- Treat ticket systems generically. Do not assume GitHub or any specific provider unless the provided context makes it relevant.
- Use the current request to determine `<planning-objective>`.
- Earlier comments remain in force when they add operative constraints, business rules, technical decisions, migration rules, exact labels or renames, ordering rules, or scoping rules.
- Use `<additional-context>` to emphasize the most important constraints, dependencies, or focus areas.
- For technical tickets, repo inspection is expected unless the request is clearly non-technical or repository context is unavailable.
- If technical details provided in the conversation are good, keep them.
- If those details are incomplete, validate and improve them.
- For existing tickets, update the same ticket instead of creating a replacement.
- Ask only when blocked by a missing or invalid ticket source, or by ambiguity that prevents a reliable plan.

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
