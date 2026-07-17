---
description: Fix PR feedback or CI failures, push updates, and reply
agent: worker
---

## Goal

Address feedback or CI failures on a pull request, validate the fixes, push them, and respond.

## Additional Context

Use `<additional-context>` to prioritize feedback and scope. Default behavior requires review; `auto` explicitly skips approval.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- Store automatic completion requests as `<execution-mode>` = `auto`; otherwise use `review`
- Store a PR number or URL as `<pr-ref>` and remaining guidance as `<additional-context>`
- Leave `<pr-ref>` undefined when absent

### Load PR Context

- Use `kompass_pr_load` as the source of truth for PR selection
- If `<pr-ref>` is defined, call `kompass_pr_load` with `pr: <pr-ref>`
- Otherwise, call `kompass_pr_load` with no arguments
- Do not run separate git or GitHub commands just to discover the PR before calling `kompass_pr_load`
- Store the result as `<pr-context>`
- Treat the loaded PR body, discussion, review history, and any attachments or linked artifacts returned by the loader as part of the source context
- Review attached images, screenshots, videos, PDFs, and other linked files whenever they can affect the requested fix, review outcome, reproduction steps, or acceptance criteria
- If any relevant attachment cannot be accessed, note that gap and continue only when the remaining PR context is still sufficient to proceed reliably

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

- If `<execution-mode>` is `auto`, skip this review gate and continue to commit and push
- Present the fix summary, changed-file count, and validation results
- If changes were made, ask one `Review Fixes` question with `Go Ahead` and `Revise`; apply custom revision feedback and repeat implementation and validation until approved
- If no changes were made, ask one `Need Feedback` question with `Revise` and `Stop Here`
- STOP if approval is required but `question` is unavailable

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

### Output

When fixes are complete, display:
```
PR fix complete for #<pr-context.pr.number>

- Changes made: <changes-count> files modified
- Base update: <base-update>
- Threads resolved: <threads-resolved>
- Validation passing: <validation-passing>
- Validation details: <validation-results>
- Pushed: <pushed>

No additional steps are required.
```
