---
description: Fix PR feedback or CI failures, push updates, and reply
agent: worker
---

## Goal

Address feedback or CI failures on a pull request by making fixes and responding to review threads.

## Additional Context

Use `<additional-context>` when prioritizing which review feedback or CI failure to address first and when deciding how much scope to take on in this pass.
- Default `/pr/fix` behavior is review-first: show the proposed fix, gather feedback, and loop until the user approves before committing, pushing, or replying on the PR.
- Treat `/pr/fix auto` as the explicit opt-in to skip the approval loop and proceed directly from passing validation to commit, push, and PR replies.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- If `<arguments>` clearly requests automatic completion (for example `auto`), store `<execution-mode>` as `auto`
- If `<arguments>` looks like a PR number (e.g., "123") or URL, store it as `<pr-ref>`
- If `<arguments>` includes extra fix guidance, scope constraints, or priorities, store it as `<additional-context>`
- Otherwise, store `<execution-mode>` as `review`
- If empty, leave `<pr-ref>` undefined and let `kompass_pr_load` resolve the default PR context

### Delegate PR Analysis

<delegate agent="reviewer" command="pr/analyze">
<pr-ref>

Additional context: <additional-context>
</delegate>

- Store the delegated result as `<pr-analysis>`
- Extract `<pr-number>` from the PR_NUMBER section of `<pr-analysis>`
- Extract `<pr-branch>` from the PR_BRANCH section of `<pr-analysis>`
- Extract `<base-branch>` from the BASE_BRANCH section of `<pr-analysis>`
- Extract `<pr-url>` from the PR_URL section of `<pr-analysis>`
- Extract `<commit-count>` from the COMMIT_COUNT section of `<pr-analysis>`
- STOP if `<pr-analysis>` is unavailable or reports no actionable feedback

### Align Local Branch

- If `<pr-branch>` is unavailable, STOP and report that the PR head branch could not be determined
- Run `gh pr checkout <pr-number>` before analyzing repository files or making code changes for this PR
- After checkout, store the active branch as `<active-branch>`
- If checkout fails or times out, STOP and report that the PR branch could not be checked out locally; do not retry checkout unless the user explicitly asks
- Do not inspect or modify local code for this PR until `<active-branch>` equals `<pr-branch>`

### Load Changes

Call `kompass_changes_load` with `base: <base-branch>`, `head: <active-branch>`, and `depthHint: <commit-count>` only when it is a positive integer. Store as `<changes>`.

### Analyze Feedback

- Use the THREADS, SUMMARY, and GROUPS sections from `<pr-analysis>` as the filtered, actionable feedback source
- Include any CI failures, logs, failing check names, or reproduction details provided in `<additional-context>` as actionable feedback
- Use `<changes>` to understand the current PR diff before deciding what to adjust
- Prioritize critical issues (bugs, security, broken contracts, failing required checks)
- Identify which files need changes

Do not blindly follow every suggestion—some may lead you off course.

### Implement Fixes

1. Fix critical navigation issues first
2. Follow existing code patterns and conventions
3. Use `<active-branch>` as the working branch for every local code read or edit in this command
4. Make focused, minimal changes
5. When maintaining your current heading despite a suggestion, be prepared to explain why
6. Store the modified-file count as `<changes-count>`

### Validate Changes

Run the most relevant available validation for the fixes:
- Prefer project-native checks such as changed-area tests, linting, type checking, build verification, or other documented validation steps when they exist
- If a category of validation is not available in the project, note it explicitly instead of inventing a command
- Confirm the fixes address the feedback
- Store the collected validation details as `<validation-results>`
- Store the overall validation outcome as `<validation-passing>` with value `yes` or `no`

### Review Fixes With User

- If `<validation-passing>` is `no`, STOP and report that validation is failing before any commit, push, or PR response happens
- If `<execution-mode>` is `auto`, skip this review gate and continue directly to `### Commit And Push Updates`
- Otherwise, this review step is mandatory before any commit, push, or PR reply:
  - Present the implemented fix summary, changed file count, and validation results
  - If `<changes-count>` is greater than `0`, ask exactly one `question` with:
    - header `Review Fixes`
    - question `Do these PR fixes look good to commit, push, and respond on the PR?`
    - options:
      - `Go Ahead` - commit, push, and respond to the PR now
      - `Revise` - update the fix based on user feedback before committing
    - Keep custom answers enabled so the user can provide concrete feedback
  - If `<changes-count>` is `0`, ask exactly one `question` with:
    - header `Need Feedback`
    - question `I did not make any changes for this PR feedback or CI failure. What should I revise or investigate next?`
    - options:
      - `Revise` - provide feedback for another pass
      - `Stop Here` - stop without committing, pushing, or replying on the PR
    - Keep custom answers enabled so the user can provide concrete feedback
- Normalize the answer into one of these paths:
  - If `<changes-count>` is greater than `0`:
    - `Go Ahead` => continue to `### Commit And Push Updates`
    - `Revise` or custom feedback => store the feedback as `<review-feedback>`, then continue to `### Apply Review Feedback`
  - If `<changes-count>` is `0`:
    - `Stop Here` => STOP and report that no changes were made, so nothing was committed, pushed, or sent to the PR
    - `Revise` or custom feedback => store the feedback as `<review-feedback>`, then continue to `### Apply Review Feedback`
- Repeat this review step until the user selects `Go Ahead` after a pass that produces changes, or explicitly selects `Stop Here` when no changes were made
- If the `question` tool is unavailable while `<execution-mode>` is `review`, STOP and report that approval is required before commit, push, or PR replies

### Apply Review Feedback

- Use `<review-feedback>` to refine the implementation without widening scope unless the feedback explicitly asks for it
- Return to `### Implement Fixes`, then rerun validation and the review step

### Commit And Push Updates

If validation passes:
1. Stage changes: `git add -A`
2. Create commit (use `commit` tool or `git commit`)
3. Push branch: `git push`
4. Store push status as `<pushed>` with value `yes` or `no`

### Respond to Threads

Only after commit and push succeed, reply to addressed threads:
- Keep replies short and factual—clear signals, no chatter
- Use `kompass_pr_sync` to post comments or replies:

```
# General PR comment
kompass_pr_sync refUrl="<pr-url>" commentBody="<reply-text>"

# Reply to a specific review thread (use comment.id from threads.comments)
kompass_pr_sync refUrl="<pr-url>" replies=[{"inReplyTo": <comment-id>, "body": "<reply-text>"}]

# Follow-up inline review comment on a specific line
kompass_pr_sync refUrl="<pr-url>" commitId="<commit-sha>" review={"comments": [{"path": "<file-path>", "line": <line-number>, "body": "<reply-text>"}]}
```

Confirm which feedback was addressed and which was intentionally not followed.
- Store the number of resolved threads as `<threads-resolved>`

### Output

When waiting for approval or revision feedback, display:
```
Review fixes for PR #<pr-number>

- Changes made: <changes-count> files modified
- Validation passing: <validation-passing>
- Validation details: <validation-results>
```

If the workflow stops after a no-change pass, display:
```
No changes made for PR #<pr-number>

- Changes made: 0 files modified
- Validation passing: <validation-passing>
- Validation details: <validation-results>

No additional steps are required.
```

When fixes are complete, display exactly this final completion summary and stop. Do not continue with extra analysis, planning, or follow-up tasks unless the workflow is blocked or the user asked for more:
```
PR fix complete for #<pr-number>

- Changes made: <changes-count> files modified
- Threads resolved: <threads-resolved>
- Validation passing: <validation-passing>
- Validation details: <validation-results>
- Pushed: <pushed>

No additional steps are required.
```
