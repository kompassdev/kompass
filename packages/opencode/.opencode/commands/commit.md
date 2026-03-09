---
description: Commit current changes with a message
agent: build
---

## Goal

Create a commit with an appropriate message summarizing the uncommitted changes.

## Workflow

### Interpret Arguments

Store `$ARGUMENTS` as `<arguments>`:
- If `<arguments>` provides guidance for the commit message, store it as `<additional-context>`
- If empty, proceed with the default commit analysis

### Load Changes

#### Step 1: Load Changes
- call `kompass_changes_load`
- pass `uncommitted: true` to get uncommitted changes only
- Use `kompass_changes_load` as the source of truth; no additional git analysis commands are needed

#### Step 2: Analyze Files
- Review the paths, statuses, and diffs from `kompass_changes_load`
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

## Additional Context

Consider `<additional-context>` when analyzing changes and writing the commit message.

## Output

When the commit is created, display:
```
Created commit `<hash>`:

<commit-message>
```