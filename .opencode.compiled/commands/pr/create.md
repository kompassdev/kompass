---
description: Summarize branch work and create a PR
agent: build
---

## Goal

Create a pull request for the current branch, handling the entire workflow from change detection to PR submission.

## Workflow

1. **Load & Analyze Changes**: 
   ## Change Analysis Guide

### Analysis Phase
1. Call `changes_load` tool. If $ARGUMENTS is provided, pass it as the `base` parameter
2. Analyze the changed files:
   - File paths and their purposes
   - The nature of changes (added, modified, deleted)
   - Lines added/removed per file
3. Group related changes into logical themes
4. Summarize the "what" and "why" (not the "how")

2. **Check Blockers**:
   - If `comparison` is "uncommitted":
     - STOP immediately
     - Report: "There are uncommitted changes. Please commit or stash them before creating a PR."
     - List the changed files from the result
     - Do NOT proceed further
   - If `branch` equals the base branch name:
     - STOP immediately  
     - Report: "You are currently on the base branch ({base}). Please checkout a feature branch before creating a PR."
     - Suggest: `git checkout -b <feature-name>`
     - Do NOT proceed further

3. **Review Commits and Files**:
   - Note the base branch and current branch from the result
   - Review commit messages to understand the narrative
   - Read the most relevant changed source files to understand the changes
   - Group related changes into themes for the PR summary

4. **Push Branch**: If needed, push the current branch to origin

5. **Create PR**: Use `gh pr create` to create the pull request:
   - Generate a concise title (max 70 chars) summarizing the change
   - Generate a body with:
     - `## Summary` - 1-3 bullets focused on WHY the change exists
     - `## Testing` - concrete validation steps or note if not tested
   - Do NOT restate the full diff
   - Keep it compact and directional

6. **Return Result**: Output the PR URL or any errors encountered

## PR Body Guidelines

- Keep summary focused on intent, not implementation details
- Testing section: mention commands run (tests, typecheck, etc.) or "No testing performed"
- Uncommitted changes and being on base branch block PR creation entirely

$ARGUMENTS can be an explicit base branch name or extra context to guide PR creation.