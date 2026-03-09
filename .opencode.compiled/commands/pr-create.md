# pr/create

**Agent:** build

**Description:** Summarize branch work and create a PR

---

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
## Change Summary & Commit Navigation Guide

When creating commits, follow this compass:

### Analysis Phase
1. Call `changes_load` to get the current diff against the base branch
2. Analyze the changed files:
   - File paths and their purposes
   - The nature of changes (added, modified, deleted)
   - Lines added/removed per file
3. Group related changes into logical themes
4. Summarize the "what" and "why" (not the "how")

### Commit Message Format
- Start with a high-level overview (1 sentence)
- For commits: One line if possible, max 72 characters
- Use conventional commit format: "feat:", "fix:", "refactor:", "docs:", etc.
- Add body only if additional context is essential

### Commit Phase
1. Check git status to confirm what will be committed
2. Stage changes with `git add` (use `-A` for all, or specific files)
3. Create the commit with the generated message
4. Use `git diff --cached` to review staged changes before committing if unsure

Interpret $ARGUMENTS as optional base-branch or extra context for the journey.
Follow the PR Author Navigation Guide and Change Summary Guide above to create the pull request.