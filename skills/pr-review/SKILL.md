---
name: pr-review
description: Review branch or PR changes with structured loading and evidence-first findings
---

## Use this skill

Use this for `/review` and `/pr/review` flows.

## Workflow

1. Use `pr_load` for PR-based review and `changes_load` for branch-based review.
2. Inspect the changed files before writing findings.
3. Focus on bugs, regressions, missing edge cases, and accidental behavior changes.
4. Only publish comments when the command explicitly asks for it.

## Output rules

- Be certain before calling something a bug.
- Prefer a small number of high-confidence findings.
- When publishing comments, make each one actionable and specific.
- When not publishing, present the review clearly in chat.
