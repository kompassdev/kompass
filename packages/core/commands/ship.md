## Goal

Ship the current work by delegating branch creation, commit creation, and PR creation.

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

### Ensure Feature Branch

<task agent="general" command="/branch">
Branch naming guidance: <branch-context>
</task>

- Store the subagent result as `<branch-result>`
- If `<branch-result>` is blocked or incomplete, STOP and report the branch blocker
- If `<branch-result>` says there was nothing to branch from, continue without changing branches
- Otherwise, continue with the created branch

### Delegate Commit

<task agent="general" command="/commit">
Additional context: <additional-context>
</task>

- Store the subagent result as `<commit-result>`

- If `<commit-result>` says there was nothing to commit, continue without creating a new commit
- If `<commit-result>` is blocked or incomplete, STOP and report the commit blocker
- Otherwise, continue with the created commit

### Delegate PR Creation

<task agent="general" command="/pr/create">
Base branch: <base>
Additional context: <additional-context>
</task>

- Store the subagent result as `<pr-result>`

- If `<pr-result>` is blocked or incomplete, STOP and report the PR blocker
- If `<pr-result>` says there is nothing to include in a PR, STOP and report that there is nothing to ship
- Otherwise, continue with the created or existing PR

## Additional Context

Use `<branch-context>` to steer delegated branch naming. Use `<additional-context>` to refine the delegated commit and PR summaries. Pass `<base>` through to PR creation when it was provided.

## Output

If there is nothing to ship, display:
```
Nothing to ship
```

When complete, display:
```
Ship flow complete

Branch: <branch-result>
Commit: <commit-result>
PR: <pr-result>
```
