## Goal

Create a scoped implementation plan from a request or ticket and present it directly without modifying any ticket state.

## Additional Context

- Treat ticket systems generically. Do not assume GitHub or any specific provider unless the provided context makes it relevant.
- Use the current request to determine `<planning-objective>`.
- Earlier comments remain in force when they add operative constraints, business rules, technical decisions, migration rules, exact labels or renames, ordering rules, or scoping rules.
- Use `<additional-context>` to emphasize the most important constraints, dependencies, or focus areas.
- For technical tickets, repo inspection is expected unless the request is clearly non-technical or repository context is unavailable.
- If technical details provided in the conversation are good, keep them.
- If those details are incomplete, validate and improve them.
- If a ticket source was provided, use it as planning context only; do not sync updates back automatically.
- Ask only when blocked by a missing or invalid ticket source, or by ambiguity that prevents a reliable plan.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

<%~ include("@ticket-planning", { config: it.config }) %>

### Present Plan

- Return the generated title and plan details without creating or updating a ticket
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

Plan:
<plan-description>

## Implementation
- <requirement-item>

## Validation
- <validation-item>

No additional steps are required.
```
