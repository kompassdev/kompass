---
description: Plan work from a request and create a ticket
agent: planner
---

## Goal

Create a development plan from a request or ticket, mapping out scope and implementation approach.

## Workflow

### Interpret Arguments

Store `$ARGUMENTS` as `<arguments>`, then normalize it:
- Interpret `<arguments>` as `<request-source>` (ticket reference, URL, file path, or raw request)
- If `<arguments>` explicitly asks to create a new GitHub issue, store that intent as `<create-ticket>`
- If `<arguments>` includes planning focus areas, constraints, or notes, store them as `<additional-context>`

### Load Request Context

- If `<request-source>` looks like a ticket reference or URL, use `ticket_load` and store the result as `<request-context>`
- Otherwise, treat `<request-source>` as `<request-context>`

### Orient

- Normalize `<request-context>` into a clear problem statement
- Identify what needs to be built, what is out of scope, and what assumptions might send the work off course

### Map the Plan

- Define scope and boundaries
- Identify constraints and limitations
- Note unknowns that still need investigation
- Define acceptance criteria
- Outline implementation waypoints and sequencing

### Create Ticket

- Only if `<create-ticket>` is explicitly requested, use `ticket_create` to open a GitHub issue
- Include a clear title, description, and acceptance criteria
- Store the new issue reference as `<ticket-ref>`

### Present Plan

- Use clear headings and structure
- Call out assumptions, risks, and blockers early
- Ask for clarification only when truly blocked by missing product intent

## Additional Context

- Keep the plan navigation-ready with clear headings and no ambiguity
- Use `<additional-context>` to emphasize the most important constraints, dependencies, or focus areas
- Only create tickets when `<create-ticket>` is explicitly set

## Output

When the plan is ready, display:
```
Plan ready: <request-summary>

Scope: <scope-summary>
Waypoints: <waypoint-summary>
Ticket: <ticket-ref-or-none>
```