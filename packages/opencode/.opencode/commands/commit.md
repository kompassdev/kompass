---
description: Commit current changes with a message
agent: build
---

## Goal

Create a commit with an appropriate message summarizing the uncommitted changes.

## Workflow

### Interpret Arguments

Store $ARGUMENTS as <arguments>:
- if <arguments> provides guidance for the commit message, store it as <additional-context>

### Load Changes

#### Step 1: Load Changes
- call `changes_load`
- pass `uncommitted: true` to get uncommitted changes only
- Use the `changes_load` result as the source of truth for analyzing and summarizing the pending work

#### Step 2: Analyze Files
- Review file paths and their purposes
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
1. Check git status to confirm what will be committed
2. Stage changes with `git add` (use `-A` for all, or specific files)
3. Generate the commit message and store it as `<commit-message>`
4. Create the commit with `<commit-message>` using `git commit -m`

Consider `<additional-context>` when analyzing changes and writing the commit message.

## Output

When the commit is created, display:
```
Created commit `<hash>`:

<commit-message>
```