## Goal

Create a scoped implementation plan from a request or ticket and present it directly without modifying any ticket state.

## Additional Context

Use `<additional-context>` to prioritize constraints, dependencies, and focus areas. Treat a provided ticket as planning context only; leave ticket state unchanged.

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
