---
description: Commit and push current changes
agent: build
---

## Goal

Create a commit and immediately push it to the remote repository.

## Workflow

1. **Analyze Changes**:
   ## Change Analysis Guide

### Analysis Phase
1. Call `changes_load` with `uncommitted: true` to get uncommitted changes only
2. Analyze the changed files:
   - File paths and their purposes
   - The nature of changes (added, modified, deleted)
   - Lines added/removed per file
3. Group related changes into logical themes
4. Summarize the "what" and "why" (not the "how")

2. **Create Commit**:
   ## Commit Navigation Guide

### Message Format
- Start with a high-level overview (1 sentence)
- One line if possible, max 72 characters
- Use conventional commit format: "feat:", "fix:", "refactor:", "docs:", etc.
- Add body only if additional context is essential

### Commit Phase
1. Check git status to confirm what will be committed
2. Stage changes with `git add` (use `-A` for all, or specific files)
3. Create the commit with the generated message
4. Use `git diff --cached` to review staged changes before committing if unsure
   
   Interpret $ARGUMENTS as the commit message. If a message is provided via $ARGUMENTS, use it directly. If no message is provided, use the generated message from the analysis phase.

3. **Push to Remote**:
   - Push the branch with `git push`
   - Use `-u` flag if the branch has no upstream set
   - Handle any merge conflicts if they arise
   - Confirm success and report the result