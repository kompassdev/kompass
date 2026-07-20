---
description: Assess PR feedback and CI failures, fix valid issues, push, and reply
agent: worker
---

## Goal

Independently assess PR feedback and CI failures, implement valid fixes, push them, and respond to each current concern.

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
- Initialize `<handled-feedback-ids>` as an empty set

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

- If `<execution-mode>` is `auto`, skip this review gate and continue to commit and push
- Present the fix summary, changed-file count, and validation results
- If changes were made, ask one `Review Fixes` question with `Go Ahead` and `Revise`; apply custom revision feedback and repeat implementation and validation until approved
- If no changes were made but `disputed` or `needs-clarification` replies are pending, present `<feedback-assessment>` and ask one `Review Feedback` question with `Post Replies` and `Revise`
- If no changes were made and no replies are pending, ask one `Need Feedback` question with `Revise` and `Stop Here`
- STOP if approval is required but `question` is unavailable

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

### Output

When `<fix-status>` is `complete`, display:
```
PR fix complete for #<pr-context.pr.number>

- Changes made: <changes-count> files modified
- Base update: <base-update>
- Feedback actionable: <feedback-actionable>
- Feedback declined: <feedback-declined>
- Replies posted: <feedback-replies-posted>
- Validation passing: <validation-passing>
- Validation details: <validation-results>
- Pushed: <pushed>

No additional steps are required.
```

When `<fix-status>` is `waiting for clarification`, display:
```
PR fix waiting for clarification for #<pr-context.pr.number>

- Changes made: <changes-count> files modified
- Feedback declined: <feedback-declined>
- Feedback awaiting clarification: <feedback-awaiting-clarification>
- Replies posted: <feedback-replies-posted>
- Pushed: <pushed>
```
