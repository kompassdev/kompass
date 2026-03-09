---
description: Summarize branch work and create a PR
agent: build
---

## Goal

Create a pull request for the current branch, handling the entire workflow from change detection to PR submission.

## Workflow

### Interpret Arguments

Store `$ARGUMENTS` as `<arguments>`, then analyze it to determine how to proceed:
- **Branch name**: If `<arguments>` looks like a branch reference (e.g., "main", "origin/develop"), store it as `<base>`
- **Additional context**: If `<arguments>` provides guidance (focus areas, related issues, notes), store it as `<additional-context>`
- **Empty**: If no `<arguments>` provided, proceed with defaults

### Load & Analyze Changes

#### Step 1: Load Changes
- call `kompass_changes_load`
- If `<base>` is defined: call `kompass_changes_load` with the `base` parameter set to `<base>`
- Otherwise: call `kompass_changes_load` with no parameters
- Never pass `uncommitted: true` in this command
- Use `kompass_changes_load` as the source of truth; no additional git analysis commands are needed

#### Step 2: Analyze Files
- Review the paths, statuses, and diffs from `kompass_changes_load`
- Identify the nature of changes (added, modified, deleted)
- Note lines added/removed per file

#### Step 3: Group and Summarize
- Group related changes into logical themes
- Summarize the "what" and "why" (not the "how")

### Check Blockers

- If `comparison` is "uncommitted":
  - STOP immediately
  - Report: "There are uncommitted changes. Please commit or stash them before creating a PR."
  - List the changed files from the result
  - Do NOT proceed further
- Treat this as a blocker only when `kompass_changes_load` returns `comparison: "uncommitted"` from the default call above; never force that mode during PR creation
- If `branch` equals `<base>`:
  - STOP immediately
  - Report: "You are currently on the base branch (<base>). Please checkout a feature branch before creating a PR."
  - Suggest: `git checkout -b <feature-name>`
  - Do NOT proceed further

### Summarize Changes

- Note the comparison mode, base branch, and current branch from the result
- Review commit messages when they are available to understand the delivery narrative
- Read the most relevant changed source files to understand the changes
- Group related changes into themes for the final summary

### Push Branch

Run `git push` and use its output as the source of truth.

- Do not run extra git commands just to decide whether to push
- If the branch was pushed during this run, report `Push: yes`
- If `git push` reports no push was needed, report `Push: no`
- If `Push: yes`, also report `Pushed: <current-branch> → origin/<current-branch>`

### Create PR

Use `gh pr create` to create the pull request:
- Generate a concise title (max 70 chars) summarizing the change
- Generate a body with:
  - `## Summary` - 1-3 bullets focused on WHY the change exists
  - `## Testing` - concrete validation steps or note if not tested
- Do NOT restate the full diff
- Keep it compact and directional
- Store the URL from the command output as `<pr-url>`
- Attempt `gh pr create` first; do not proactively check whether a PR already exists
- Use the command output as the source of truth for whether the PR was created or already exists
- If it reports that a PR already exists for the branch, do not try to create another one; treat the result as an existing PR and use the returned URL as `<pr-url>`
- Track whether the branch was pushed during this run and report that status in the final response

## PR Body Guidelines

- Keep summary focused on intent, not implementation details
- Testing section: mention commands run (tests, typecheck, etc.) or "No testing performed"
- Uncommitted changes and being on base branch block PR creation entirely

## Additional Context

Consider `<additional-context>` when analyzing changes and writing the PR description.

## Output

When a new PR is created, display:
```
Created PR: <title>

URL: <pr-url>
Branch: <current-branch> → <base-branch>
```

If a PR already exists for the branch, display:
```
PR already exists

URL: <pr-url>
Branch: <current-branch> → <base-branch>
```

After the branch line, always include one additional line reporting push status:
```
Push: yes
```

If `Push: yes`, include one more line:
```
Pushed: <current-branch> → origin/<current-branch>
```

If the branch did not need pushing, use:
```
Push: no
```