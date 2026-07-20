## Goal

Continuously watch a pull request, independently assess CI failures and review feedback, fix valid issues, reply, and repeat until clean or clarification is needed.

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
- Initialize `<handled-feedback-ids>` as an empty set

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
- Combine open candidate feedback and `<ci-failures>` into `<actionable-work>` without presuming that reviewer requests are valid; exclude comment IDs already handled by this workflow unless new thread context or code changes materially reopen the concern

### Confirm Clean PR Context

- When `<ci-status>` is successful or no checks are configured and `<actionable-work>` is empty, call `<%= it.config.tools.pr_load.name %>` with `pr: <pr-url>` for a final complete snapshot
- Store the result as `<final-pr-context>` and replace `<review-context>` with its reviews, issue comments, and threads
- Recompute `<actionable-work>` from the complete snapshot, excluding comment IDs already handled by this workflow unless new thread context or code changes materially reopen the concern
- If recomputed `<actionable-work>` is empty and there is no actionable CI failure, store `<fix-status>` as `complete` and continue to `### Output`
- Otherwise continue with the newly discovered work; this includes comments posted by CI after checks completed

<%~ include("@pr-fix", { config: it.config, auto: true }) %>

### Continue Loop

- If `<fix-status>` is `waiting for clarification`, continue to `### Output` without starting another pass
- Increment `<completed-fix-passes>` and return to `### Align Branch With Base`

### Output

When `<fix-status>` is `complete`, display:
```
PR loop complete for #<pr-number>

- CI status: <ci-status>
- Base update: <base-update>
- CI failures remaining: 0
- Actionable feedback remaining: 0
- Fix passes completed: <completed-fix-passes>

No additional steps are required.
```

When `<fix-status>` is `waiting for clarification`, display:
```
PR loop waiting for clarification for #<pr-number>

- CI status: <ci-status>
- Feedback declined: <feedback-declined>
- Feedback awaiting clarification: <feedback-awaiting-clarification>
- Replies posted: <feedback-replies-posted>
- Fix passes completed: <completed-fix-passes>
```
