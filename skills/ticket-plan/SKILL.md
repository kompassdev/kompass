---
name: ticket-plan
description: Convert a request or ticket into a scoped plan and optionally create a new ticket
---

## Use this skill

Use this for planning work from free text, a file, or a GitHub issue.

## Workflow

1. Use `ticket_load` when the input looks like a ticket reference, URL, or file path.
2. Normalize the problem statement.
3. Produce scope, constraints, unknowns, acceptance criteria, and implementation steps.
4. Create a ticket with `ticket_create` only when the workflow explicitly asks for it.

## Planning rules

- Keep the plan implementation-ready.
- Call out assumptions.
- Ask a question only when blocked by missing product intent.
