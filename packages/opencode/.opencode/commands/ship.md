---
description: Ship branch work through commit and PR creation
agent: navigator
---

## Goal

Ship the current work from change summary to commit and PR creation, creating a feature branch first when the user is still on the base branch.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- **Branch name**: If `<arguments>` looks like a branch reference (for example `main` or `origin/develop`), store it as `<base>`
- **Branch naming guidance**: If `<arguments>` includes wording that should influence the generated feature branch name, store it as `<branch-context>`
- **Additional context**: If `<arguments>` provides commit or PR guidance, store it as `<additional-context>`
- **Empty**: If no `<arguments>` provided, proceed with defaults

### Load Change Context

#### Step 1: Load Changes
- call `kompass_changes_load`
- If `<base>` is defined: call `kompass_changes_load` with the `base` parameter set to `<base>`
- Otherwise: call `kompass_changes_load` with no parameters
- Use the returned base branch as the default for the rest of this workflow
- Store the returned result as `<changes>`
- Use `<changes>` as the source of truth; no additional git analysis commands are needed

#### Step 2: Analyze Files
- Review the paths, statuses, and diffs from `<changes>`
- Identify the nature of changes (added, modified, deleted)
- Note lines added/removed per file

#### Step 3: Group and Summarize
- Group related changes into logical themes
- Summarize the "what" and "why" (not the "how")

### Check Blockers

- If the change summary reports no uncommitted or branch-specific work to ship, STOP and report that there is nothing to ship

### Ensure Feature Branch

- Read the current `branch`, resolved base branch, and summarized change themes from the `kompass_changes_load` result
- Store the effective base branch as `<resolved-base>` by preferring `<base>` when it was provided, otherwise using the returned base branch
- If `branch` equals `<resolved-base>`:
  - Generate a concise kebab-case slug from the summarized change themes and `<branch-context>` when available, then store it as `<branch-slug>`
  - Create and checkout `feature/<branch-slug>` with `git checkout -b`
  - If that name already exists, retry once with a short numeric suffix
  - Store the checked-out branch as `<working-branch>`
  - Store `Created branch: <working-branch>` as `<branch-result>`
- Otherwise, store the current branch as `<working-branch>`
  - Store `Created branch: no` as `<branch-result>`

### Delegate Commit

- The subagent receives `<working-branch>` and `<additional-context>`
- Define `<prompt>` as:

<prompt>
/commit

Branch: <working-branch>
Additional context: <additional-context>
</prompt>

- Call subagent `@general` with `<prompt>`
- Do not paraphrase or prepend extra text
- Store the subagent result as `<commit-result>`
- If `<commit-result>` says there was nothing to commit, STOP and report that result without creating a PR
- If `<commit-result>` is blocked or incomplete, STOP and report the commit blocker
- Otherwise, continue and store a concise commit outcome as `<commit-summary>`

### Delegate PR Creation

- The subagent receives `<resolved-base>` and `<additional-context>`
- Define `<prompt>` as:

<prompt>
/pr/create

Base branch: <resolved-base>
Additional context: <additional-context>
</prompt>

- Call subagent `@general` with `<prompt>`
- Do not paraphrase or prepend extra text
- Store the subagent result as `<pr-result>`
- If `<pr-result>` is blocked or incomplete, STOP and report the PR blocker
- Otherwise, continue and store a concise PR outcome as `<pr-summary>`

## Additional Context

Use `<branch-context>` to steer branch naming. Use `<additional-context>` to refine the delegated commit and PR summaries.

## Output

If there is nothing to ship, display:
```
Nothing to ship
```

When complete, display:
```
Ship flow complete

Branch: <working-branch>
Base: <resolved-base>
Commit: <commit-summary>
PR: <pr-summary>
<branch-result>
```