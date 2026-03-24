## Goal

Create a scoped implementation plan from a request or ticket, then capture that plan in the relevant ticket flow without losing important technical context.

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
<%~ include("@load-ticket", { source: "<ticket-url>", result: "<planning-context>", comments: true }) %>
- Otherwise, treat the relevant request and conversation context as `<planning-context>`
- If `<planning-context>` is empty or missing, STOP and report that planning context could not be determined

### Interpret Planning Context

- From `<planning-context>` and `<additional-context>`, derive:
  - `<planning-objective>` - the current planning task or request
  - `<operative-constraints>` - earlier context that still applies
  - `<proposed-technical-direction>` - technical details already proposed in the discussion
  - `<open-questions>` - only the issues that are still unresolved
- Use the current request to determine `<planning-objective>`
- Do not discard earlier comments when they still define constraints, business rules, implementation decisions, migration rules, naming, sequencing, or scoping limits

### Inspect Repo Context

- If the request is technical and repository context is available, perform light targeted reconnaissance before finalizing the plan
- Inspect the relevant code, schema, config, UI patterns, and tests needed to validate `<proposed-technical-direction>` and ground the plan
- Confirm current behavior and existing patterns instead of relying on ticket text alone
- If relevant repo context cannot be found or verified, note that gap and avoid false certainty

### Respect Planning Boundary

- This command is planning-only
- Do not implement the plan, edit files, run implementation workflows, or start coding from the proposed steps unless the user explicitly asks for implementation
- Treat repo inspection as analysis-only reconnaissance needed to improve the plan
- After syncing and presenting the plan, STOP

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

### Sync Ticket

- Use `ticket_sync` to store the plan in the ticket flow:
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

## Additional Context

- Treat ticket systems generically. Do not assume GitHub or any specific provider unless the provided context makes it relevant.
- Use the current request to determine `<planning-objective>`.
- Earlier comments remain in force when they add operative constraints, business rules, technical decisions, migration rules, exact labels or renames, ordering rules, or scoping rules.
- Use `<additional-context>` to emphasize the most important constraints, dependencies, or focus areas.
- For technical tickets, repo inspection is expected unless the request is clearly non-technical or repository context is unavailable.
- A completed plan is not authorization to implement it.
- Do not make code changes, delegate implementation, or continue into execution unless the user explicitly asks for that work.
- If technical details provided in the conversation are good, keep them.
- If those details are incomplete, validate and improve them.
- For existing tickets, update the same ticket instead of creating a replacement.
- Ask only when blocked by a missing or invalid ticket source, or by ambiguity that prevents a reliable plan.

## Output

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
