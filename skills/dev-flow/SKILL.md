---
name: dev-flow
description: Execute a request or ticket end-to-end and hand off into PR creation cleanly
---

## Use this skill

Use this for `/dev` and `/ticket/dev` flows.

## Workflow

1. Load the request from `$ARGUMENTS` or `ticket_load`.
2. Inspect the codebase before editing.
3. Implement the change following local conventions.
4. Run targeted validation.
5. Hand off to the `pr-author` flow to create the pull request.

## Notes

- Keep context compact.
- Prefer the smallest change that fully solves the request.
- Surface any follow-up work that should stay out of the current PR.
