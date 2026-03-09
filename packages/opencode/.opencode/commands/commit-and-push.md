---
description: Commit and push current changes
agent: build
---

## Goal

Create a commit and immediately push it to the remote repository.

## Workflow

### Interpret Arguments

Store $ARGUMENTS as <arguments>:
- if <arguments> provides guidance for the commit message, store it as <additional-context>

### Load Changes

#### Step 1: Load Changes
- call `changes_load`
- pass `uncommitted: true` to get uncommitted changes only
- Use `changes_load` as the source of truth; no additional git analysis commands are needed

#### Step 2: Analyze Files
- Review the paths, statuses, and diffs from `changes_load`
- Identify the nature of changes (added, modified, deleted)
- Note lines added/removed per file

#### Step 3: Group and Summarize
- Group related changes into logical themes
- Summarize the "what" and "why" (not the "how")

### Create Commit

### Message Format
- Start with a high-level overview (1 sentence)
- One line if possible, max 72 characters
- Use conventional commit format: "feat:", "fix:", "refactor:", "docs:", etc.
- Add body only if additional context is essential

### Commit Phase
1. Use the loaded change data as the source of truth for what will be committed
2. Stage changes with `git add` (use `-A` for all, or specific files)
3. Generate the commit message and store it as `<commit-message>`
4. Create the commit with `<commit-message>` using `git commit -m`
5. Only run `git status` if the commit fails and additional diagnosis is required

Use `changes_load` as the source of truth for what will be committed; do not run `git status` separately unless the commit fails and additional diagnosis is required.

Consider `<additional-context>` when analyzing changes and writing the commit message.

### Push to Remote

- Push the branch with `git push`
- Use `-u` flag if the branch has no upstream set
- Handle any merge conflicts if they arise

## Output

When complete, display:
```
Created commit `<hash>`:

<commit-message>

Pushed to <remote>/<branch>
```