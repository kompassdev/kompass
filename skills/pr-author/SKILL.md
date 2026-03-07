---
name: pr-author
description: Create pull requests from current branch work with a compact, high-signal summary
---

## Use this skill

Use this when the task ends with creating a pull request.

## Workflow

1. Call `changes_load` before raw git commands.
2. Confirm the base branch from explicit input first, otherwise use the tool result.
3. Review commits, changed files, and the working tree state.
4. Read the most relevant changed files before drafting the PR.
5. Push the branch if needed.
6. Create the PR with a concise title and body.

## PR body shape

- `## Summary` with 1-3 bullets focused on why the change exists
- `## Testing` with concrete validation steps or a note if validation was not run

## Notes

- Keep the summary compact.
- Do not restate the full diff.
- If there are uncommitted changes, either include them intentionally or call them out clearly.
