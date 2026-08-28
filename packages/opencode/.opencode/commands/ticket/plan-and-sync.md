---
description: Plan work from a request or ticket and sync the result
agent: planner
---

## Goal

Create a scoped implementation plan from a request or ticket, then capture that plan in the relevant ticket flow without losing important technical context.

## Additional Context

Use `<additional-context>` to prioritize constraints, dependencies, and focus areas. Update a provided ticket in place; create a ticket only when the source is a request rather than an existing ticket.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- If `<arguments>` looks like a ticket reference or URL, store it as `<ticket-url>`
- Otherwise, treat `<arguments>` as `<request>`
- If `<arguments>` includes planning focus areas, constraints, or notes beyond the main request, store them as `<additional-context>`
- If no `<arguments>` are provided, derive the current request from the conversation and store it as `<request>`

### Load Planning Context

- If `<ticket-url>` is defined:
- Use `kompass_ticket_load` with `source: <ticket-url>` and `comments: true`
- Store the result as `<planning-context>`
- Treat the loaded ticket body, discussion, and any attachments or linked artifacts returned by the loader as part of the source context
- Review each attachment that can change requirements, acceptance criteria, reproduction steps, design direction, or the requested answer
- Store inaccessible relevant attachments as `<attachment-gaps>`; STOP when a gap prevents a supported decision, otherwise exclude the missing material from the evidence used
- Otherwise, treat the relevant request and conversation context as `<planning-context>`
- If `<planning-context>` is empty or missing, STOP and report that planning context could not be determined

### Interpret Planning Context

- Treat ticket providers generically unless `<planning-context>` requires provider-specific behavior
- From `<planning-context>` and `<additional-context>`, derive:
  - `<planning-objective>` - the current planning task or request
  - `<operative-constraints>` - earlier context that still applies
  - `<proposed-technical-direction>` - technical details already proposed in the discussion
  - `<open-questions>` - only the issues that are still unresolved
- Use the current request to determine `<planning-objective>`
- Do not discard earlier comments when they still define constraints, business rules, implementation decisions, migration rules, naming, sequencing, or scoping limits
- Ask one focused question only when an unresolved issue prevents a reliable plan

### Inspect Repo Context

- For a technical request with repository access, inspect the implementation, contracts, configuration, and tests needed to verify current behavior and `<proposed-technical-direction>`
- Store unverified material claims as `<planning-gaps>` instead of presenting them as facts

### Shape the Plan

- Turn `<planning-objective>`, `<operative-constraints>`, `<proposed-technical-direction>`, `<open-questions>`, and repo findings into:
  - `<plan-title>` - a short, useful title
  - `<plan-description>` - a brief description of the intended outcome, scope, important constraints, and material technical direction
  - `<requirement-items>` - concise requirement checklist items
  - `<validation-items>` - validation checklist items
- Preserve good technical details from the ticket or conversation when they are valid
- Improve incomplete technical details when repo inspection provides a better grounded direction
- Do not replace material technical guidance with generic outcome language
- Avoid placeholder-like labels or awkward title formats such as `Ticket`, `Description`, or `Ticket : Description`
- Before finishing, account for every item in `<operative-constraints>` and every resolved item in `<open-questions>` in the description or a requirement item
- Give every requirement at least one validation item that would prove it works, combining checks only when one check genuinely covers several requirements

### Sync Ticket

- Use `kompass_ticket_sync` to store the plan in the ticket flow:
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
