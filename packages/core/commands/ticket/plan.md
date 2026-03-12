## Goal

Create a scoped implementation plan from a request or ticket, then capture that plan in the relevant ticket flow.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- If `<arguments>` looks like a ticket reference or URL, store it as `<ticket-url>`
- Otherwise, treat `<arguments>` as `<request>`
- If `<arguments>` includes planning focus areas, constraints, or notes beyond the main request, store them as `<additional-context>`
- If no `<arguments>` are provided, derive the request from the conversation and store it as `<request>`

### Load Planning Context

- If `<ticket-url>` is defined, use `ticket_load` with `<ticket-url>` and treat the result as `<planning-context>`
- Otherwise, treat `<request>` as `<planning-context>`
- If `<planning-context>` is empty or missing, STOP and report that planning context could not be determined

### Shape the Plan

- Turn `<planning-context>` and `<additional-context>` into:
  - `<plan-title>` - a short, outcome-focused title for the ticket
  - `<plan-description>` - a brief description of the intended outcome and scope
  - `<requirement-items>` - concise, outcome-focused requirement checklist items
  - `<validation-items>` - concise validation checklist items
- Keep the plan concise, human-friendly, and centered on scope, constraints, and expected outcomes
- Avoid placeholder-like labels or awkward title formats such as `Ticket`, `Description`, or `Ticket : Description`

### Sync Ticket

- Use `ticket_sync` to store the plan in the ticket flow:
  - set `title` to `<plan-title>`
  - set `description` to `<plan-description>`
  - set `checklists` to two sections:
    - `Requirement` with `<requirement-items>`
    - `Validation` with `<validation-items>`
  - set `refUrl` to `<ticket-url>` when updating an existing ticket
  - leave `refUrl` unset when creating a new ticket from the request
- Store the returned ticket URL as `<ticket-url>`

### Present Plan

- Return only the generated title and the ticket reference or URL
- Call out assumptions, risks, or blockers only when they materially matter

## Additional Context

- Treat ticket systems generically. Do not assume GitHub or any specific provider unless the provided context makes it relevant.
- Use `<additional-context>` to emphasize the most important constraints, dependencies, or focus areas.
- For existing tickets, update the same ticket instead of creating a replacement, and keep checklist items and descriptions outcome-focused rather than implementation-focused.
- Ask only when blocked by a missing or invalid ticket source, or by ambiguity that prevents a reliable plan.

## Output

If planning context cannot be determined, display:
```
Unable to plan: missing request or ticket context
```

When the plan is ready, display:
```
Title: `<plan-title>`
URL: `<ticket-url>`
```
