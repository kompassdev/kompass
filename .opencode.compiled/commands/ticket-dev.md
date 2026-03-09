# ticket/dev

**Agent:** build

**Description:** Implement a ticket and create a PR

---

## Development Flow Navigation Guide

When implementing a request or ticket, follow this compass:

### Workflow
1. Orient yourself by loading the request from `$ARGUMENTS` or `ticket_load`
2. Survey the codebase before plotting your route
3. Navigate the implementation following local conventions
4. Validate the path with targeted checks
5. Hand off to the PR creation flow to signal arrival at the pull request

### Guidelines
- Keep context compact—pack light for the journey
- Prefer the smallest course correction that fully reaches the destination
- Surface any detours or follow-up destinations that should stay off the current route
## PR Author Navigation Guide

When creating a pull request, follow this compass:

### Workflow
1. Call `changes_load` to survey the current branch against the base branch
2. Confirm the base branch from explicit input first, otherwise use the tool result as your north star
3. Review commits, changed files, and the working tree state
4. Read the most relevant changed files before charting the PR
5. Push the branch if the course needs updating
6. Create the PR with a concise title and body that signals the destination

### PR Body Structure
- `## Summary` with 1-3 bullets focused on why the change exists
- `## Testing` with concrete validation steps or a note if validation was not run

### Guidelines
- Keep the summary compact—signal the direction, don't detail every step
- Do not restate the full diff
- If there are uncommitted changes, either include them intentionally or call them out clearly

Interpret $ARGUMENTS as the destination (ticket reference, file path, or raw request).
Use ticket_load to get your bearings, then follow the Development Flow and PR Author guides to navigate to completion and arrive at a PR.