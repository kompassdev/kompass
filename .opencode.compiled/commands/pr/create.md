---
description: Summarize branch work and create a PR
agent: build
---

1. Call `changes_load` to survey the current branch:
   - If $ARGUMENTS is provided, pass it as the `base` parameter
   - If $ARGUMENTS is empty, call changes_load with no arguments (uses default base branch detection)
2. Check the result:
   - If `comparison` is "uncommitted", STOP and tell the user: "There are uncommitted changes. Please commit or stash them before creating a PR." - then list the files and DO NOT proceed
   - Otherwise, proceed with PR creation using the result

## PR Author Navigation Guide

When creating a pull request, follow this compass:

### Workflow
1. Confirm the base branch from explicit input first, otherwise use the tool result as your north star
2. Review commits, changed files, and the working tree state
3. Read the most relevant changed files before charting the PR
4. Push the branch if the course needs updating
5. Create the PR with a concise title and body that signals the destination

### PR Body Structure
- `## Summary` with 1-3 bullets focused on why the change exists
- `## Testing` with concrete validation steps or a note if validation was not run

### Guidelines
- Keep the summary compact—signal the direction, don't detail every step
- Do not restate the full diff
- Uncommitted changes are checked and blocked before PR creation

$ARGUMENTS can be an explicit base branch name or extra context to guide PR creation.