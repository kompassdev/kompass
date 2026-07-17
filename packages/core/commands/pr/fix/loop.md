## Goal

Continuously watch a pull request, fix CI failures and new review feedback, push, reply, and repeat until clean.

## Additional Context

- Use `<additional-context>` to constrain feedback and CI handling
- This workflow is non-interactive and must not ask for approval
- Preserve the initial PR snapshot and use incremental review checkpoints on later passes

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- Store a PR number or URL as `<pr-ref>` and remaining guidance as `<additional-context>`
- Initialize `<completed-fix-passes>` as `0`

### Load Initial PR Context

<%~ include("@load-pr", { config: it.config, ref: "<pr-ref>", result: "<pr-context>" }) %>
- Store `<pr-url>`, `<pr-number>`, and `<review-checkpoint>` from `<pr-context.pr.url>`, `<pr-context.pr.number>`, and `<pr-context.loadedAt>`
- Store the initial reviews, issue comments, and threads as `<review-context>`
- STOP if any required value is unavailable

### Align Branch With Base

<%~ include("@pr-branch-update") %>

### Watch CI

- Run `gh pr checks <pr-number> --watch`
- Store success or no configured checks as `<ci-status>`
- Capture failing, cancelled, timed out, missing, or inconclusive checks as `<ci-failures>` without stopping

### Load Incremental Feedback

- Call `<%= it.config.tools.pr_load_review.name %>` with `pr: <pr-url>` and `since: <review-checkpoint>`
- Store the result as `<fresh-review-context>` and advance `<review-checkpoint>` to `<fresh-review-context.loadedAt>`
- Merge new reviews, issue comments, and whole changed threads into `<review-context>`, deduplicating by stable IDs
- Combine open actionable feedback and `<ci-failures>` into `<actionable-work>`
- If there is no actionable feedback and no actionable CI failure, continue to `### Output`

<%~ include("@pr-fix", { config: it.config, auto: true }) %>

### Continue Loop

- Increment `<completed-fix-passes>` and return to `### Align Branch With Base`
- Do not call `<%= it.config.tools.pr_load.name %>` again during this loop

### Output

When complete, display:
```
PR loop complete for #<pr-number>

- CI status: <ci-status>
- Base update: <base-update>
- CI failures remaining: 0
- Actionable feedback remaining: 0
- Fix passes completed: <completed-fix-passes>

No additional steps are required.
```
