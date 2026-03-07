---
name: pr-fix
description: Turn PR review feedback into code changes, validation, and follow-up replies
---

## Use this skill

Use this when existing PR feedback needs to be addressed.

## Workflow

1. Use `pr_load` with reviews and comments enabled.
2. Separate actionable requests from non-actionable or already-resolved feedback.
3. Fix the real issues first.
4. Run the most relevant validation.
5. Push the branch.
6. Reply with a concise resolution note for each addressed thread when the workflow asks for it.

## Notes

- Do not blindly implement every comment.
- Explain when a comment is not applied.
- Keep replies short and factual.
