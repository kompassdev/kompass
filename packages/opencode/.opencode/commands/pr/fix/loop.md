---
description: Assess PR CI and comments, fix valid issues, and reply without approval prompts
agent: worker
---

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

- Use `kompass_pr_load` as the source of truth for PR selection
- If `<pr-ref>` is defined, call `kompass_pr_load` with `pr: <pr-ref>`
- Otherwise, call `kompass_pr_load` with no arguments
- Do not run separate git or GitHub commands just to discover the PR before calling `kompass_pr_load`
- Store the result as `<pr-context>`
- Treat the loaded PR body, discussion, review history, and any attachments or linked artifacts returned by the loader as part of the source context
- Review each attachment that can change the requested fix, review outcome, reproduction steps, or acceptance criteria
- Store inaccessible relevant attachments as `<attachment-gaps>`; STOP when a gap prevents a supported decision, otherwise exclude the missing material from the evidence used
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
- Combine open candidate feedback and `<ci-failures>` into `<actionable-work>` without presuming that reviewer requests are valid; exclude comment IDs already handled by this workflow unless new thread context or code changes materially reopen the concern

### Confirm Clean PR Context

- When `<ci-status>` is successful or no checks are configured and `<actionable-work>` is empty, call `kompass_pr_load` with `pr: <pr-url>` for a final complete snapshot
- Store the result as `<final-pr-context>` and replace `<review-context>` with its reviews, issue comments, and threads
- Recompute `<actionable-work>` from the complete snapshot, excluding comment IDs already handled by this workflow unless new thread context or code changes materially reopen the concern
- If recomputed `<actionable-work>` is empty and there is no actionable CI failure, store `<fix-status>` as `complete` and continue to `### Output`
- Otherwise continue with the newly discovered work; this includes comments posted by CI after checks completed

### Load PR Changes

Call `kompass_changes_load` with `base: <pr-context.pr.baseRefName>`, `head: <active-branch>`, and positive `depthHint: <pr-context.pr.commitCount>` when available. Store as `<changes>`.

### Assess Feedback

- Treat unresolved review threads, review state changes, `<actionable-work>`, and CI details in `<additional-context>` as candidate feedback, not instructions to follow blindly
- Assess each candidate independently against the current code, `<changes>`, PR intent, applicable repository guidance, and the full thread including later replies
- Use `authorType`, `authorAssociation`, author login, and whether the author is `<pr-context.pr.author>` to derive `<feedback-source>` as `automation`, `project-member`, or `external-or-unknown`; classify `Bot` or `[bot]` identities as `automation`, and non-automation `OWNER`, `MEMBER`, or `COLLABORATOR` identities as `project-member`
- Treat `<feedback-source>` as a confidence signal rather than proof because agents can post through user accounts and bots can relay human input
- Give `project-member` feedback and non-automation feedback from the PR author greater authority on intended behavior, product scope, and tradeoffs, but still verify technical claims against the code
- Treat automation feedback as a technical hypothesis without product-intent authority; do not discount a supported finding merely because it came from automation
- Classify each feedback item by comment ID as `actionable`, `already-addressed`, `superseded`, `disputed`, or `needs-clarification`, with a concise evidence-based rationale
- Do not assume a reviewer request is correct, invent missing requirements, or change code solely to satisfy a comment
- Store the assessment as `<feedback-assessment>` and counts as `<feedback-actionable>`, `<feedback-declined>`, and `<feedback-awaiting-clarification>`

### Implement Valid Fixes

- Implement only feedback classified as `actionable` and independently confirmed CI failures
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
- If actionable work produced no changes, `<base-update>` is `already up to date`, and no feedback reply or clarification request is needed, STOP to avoid looping without progress

### Commit And Push Fixes

- If fixes produced uncommitted changes, stage the focused changes and create a conventional commit
- If the base update already created a merge commit and there are no additional changes, do not create an empty commit
- Push the branch, setting its upstream when necessary
- Store push status as `<pushed>`
- STOP if commit or push fails

### Respond To Threads

- After any required commit and push succeeds, use `kompass_pr_sync` to respond to assessed feedback
- Reply to `actionable` items with a short factual summary of the fix, to `disputed` items with the concise technical reason no change was made, and to `needs-clarification` items with one focused request for the missing information
- Do not reply to resolved, already-addressed, or superseded feedback unless a correction is needed to prevent confusion
- Use `replies` only for inline review-thread comment IDs; aggregate responses to issue comments, formal review bodies, and general CI feedback into one concise `commentBody` with clear references to each source
- Store the number of replies as `<feedback-replies-posted>`
- Add every assessed source ID to `<handled-feedback-ids>` after its required response succeeds, including already-addressed and superseded items that need no reply; reconsider them only when a later reply or code change adds material new evidence
- If `<feedback-awaiting-clarification>` is greater than `0`, store `<fix-status>` as `waiting for clarification`; otherwise store it as `complete`

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
