---
name: pr-author
description: Navigate from branch work to a merged PR with a clear, high-signal summary
---

## Use this skill

Use this when the journey ends with creating a pull request.

## Workflow

1. Call `changes_load` to get your bearings before issuing git commands.
2. Confirm the base branch from explicit input first, otherwise use the tool result as your north star.
3. Survey commits, changed files, and the working tree state.
4. Read the most relevant changed files before charting the PR.
5. Push the branch if the course needs updating.
6. Create the PR with a concise title and body that signals the destination.

## PR body shape

- `## Summary` with 1-3 bullets focused on why the change exists
- `## Testing` with concrete validation steps or a note if validation was not run

## Notes

- Keep the summary compact—signal the direction, don't detail every step.
- Do not restate the full diff.
- If there are uncommitted changes, either include them intentionally or call them out clearly.
