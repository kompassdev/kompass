---
description: Watch PR CI and comments, repeatedly fixing both without approval prompts
agent: worker
---

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

- Use `kompass_pr_load` as the source of truth for PR selection
- If `<pr-ref>` is defined, call `kompass_pr_load` with `pr: <pr-ref>`
- Otherwise, call `kompass_pr_load` with no arguments
- Do not run separate git or GitHub commands just to discover the PR before calling `kompass_pr_load`
- Store the result as `<pr-context>`
- Treat the loaded PR body, discussion, review history, and any attachments or linked artifacts returned by the loader as part of the source context
- Review attached images, screenshots, videos, PDFs, and other linked files whenever they can affect the requested fix, review outcome, reproduction steps, or acceptance criteria
- If any relevant attachment cannot be accessed, note that gap and continue only when the remaining PR context is still sufficient to proceed reliably
- Store `<pr-url>`, `<pr-number>`, and `<review-checkpoint>` from `<pr-context.pr.url>`, `<pr-context.pr.number>`, and `<pr-context.loadedAt>`
- Store the initial reviews, issue comments, and threads as `<review-context>`
- STOP if any required value is unavailable

### Align Branch With Base

### Align Local Branch

- Store `<pr-branch>` as `<pr-context.pr.headRefName>`
- STOP if `<pr-branch>` is unavailable
- Run `gh pr checkout <pr-context.pr.number>` before inspecting or modifying code
- Store the active branch as `<active-branch>` and STOP unless it equals `<pr-branch>`

### Update Branch From Base

- Store `<base-branch>` as `<pr-context.pr.baseRefName>` and STOP if it is unavailable
- Run `git fetch origin <base-branch>`, then store `origin/<base-branch>` as `<base-ref>`
- Run `git merge-base --is-ancestor <base-ref> HEAD` to confirm whether the PR branch contains the latest base
- If the branch is behind, merge `<base-ref>` into `<active-branch>` without rebasing or force-pushing; resolve conflicts using repository context, complete the merge, push the merge commit, and store its hash as `<base-update>`
- If the branch is current, store `<base-update>` as `already up to date`
- STOP before making PR fixes if the fetch, merge, conflict resolution, or push cannot be completed safely

### Watch CI

- Run `gh pr checks <pr-number> --watch`
- Store success or no configured checks as `<ci-status>`
- Capture failing, cancelled, timed out, missing, or inconclusive checks as `<ci-failures>` without stopping

### Load Incremental Feedback

- Call `kompass_pr_load_review` with `pr: <pr-url>` and `since: <review-checkpoint>`
- Store the result as `<fresh-review-context>` and advance `<review-checkpoint>` to `<fresh-review-context.loadedAt>`
- Merge new reviews, issue comments, and whole changed threads into `<review-context>`, deduplicating by stable IDs
- Combine open actionable feedback and `<ci-failures>` into `<actionable-work>`
- If there is no actionable feedback and no actionable CI failure, continue to `### Output`

### Load PR Changes

Call `kompass_changes_load` with `base: <pr-context.pr.baseRefName>`, `head: <active-branch>`, and positive `depthHint: <pr-context.pr.commitCount>` when available. Store as `<changes>`.

### Analyze And Implement Fixes

- Treat unresolved review threads, review state changes, `<actionable-work>`, and CI details in `<additional-context>` as candidate feedback
- Use `<changes>` to understand the current PR scope
- Separate true course corrections from noise, resolved feedback, and superseded feedback
- Fix critical correctness, security, contract, and required-CI issues first
- Follow existing patterns and make focused, minimal changes
- Store the modified-file count as `<changes-count>`

### Validate Fixes

- Run the most relevant available validation
- Prefer project-native checks such as changed-area tests, linting, type checking, build verification, or other documented validation steps when they exist
- If a category of validation is not available in the project, note it explicitly instead of inventing a command
- Store details as `<validation-results>` and the outcome as `<validation-passing>` (`yes` or `no`)
- STOP before commit, push, or replies when validation fails

### Review Fixes

- Continue without an approval prompt
- If actionable work produced no changes and `<base-update>` is `already up to date`, STOP to avoid looping without progress

### Commit And Push Fixes

- If fixes produced uncommitted changes, stage the focused changes and create a conventional commit
- If the base update already created a merge commit and there are no additional changes, do not create an empty commit
- Push the branch, setting its upstream when necessary
- Store push status as `<pushed>`
- STOP if commit or push fails

### Respond To Threads

- Only after commit and push succeed, use `kompass_pr_sync` to post short factual replies to addressed feedback
- Reply with `replies` keyed by the addressed comment IDs; use `commentBody` only for general CI feedback
- Store the number of addressed threads as `<threads-resolved>`

### Continue Loop

- Increment `<completed-fix-passes>` and return to `### Align Branch With Base`
- Do not call `kompass_pr_load` again during this loop

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
