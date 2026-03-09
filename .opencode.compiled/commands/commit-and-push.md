---
description: Commit and push current changes
agent: build
---

## Change Summary & Commit Navigation Guide

When creating commits, follow this compass:

### Analysis Phase
1. Call `changes_load` with `uncommitted: true` to get uncommitted changes only
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

Interpret $ARGUMENTS as the commit message.
If no message is provided, follow the Change Summary & Commit Navigation Guide above to analyze changes and generate an appropriate commit message.
Then stage all changes with `git add -A`, create the commit, and push to the remote repository.
Handle any merge conflicts if they arise, and use `-u` flag if the branch has no upstream set.