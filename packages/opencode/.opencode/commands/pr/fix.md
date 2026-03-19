---
description: Fix PR feedback, push updates, and reply
agent: build
---

## Goal

Address feedback on a pull request by making fixes and responding to review threads.

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

### Load PR Context

- Use `kompass_pr_load` as the source of truth for PR selection
- If `<pr-ref>` is defined, call `kompass_pr_load` with `pr: <pr-ref>`
- Otherwise, call `kompass_pr_load` with no arguments
- Do not run separate git or GitHub commands just to discover the PR before calling `kompass_pr_load`
- Store the result as `<pr-context>`
- Treat the loaded PR body, discussion, review history, and any attachments or linked artifacts returned by the loader as part of the source context
- Review attached images, screenshots, videos, PDFs, and other linked files whenever they can affect the requested fix, review outcome, reproduction steps, or acceptance criteria
- If any relevant attachment cannot be accessed, note that gap and continue only when the remaining PR context is still sufficient to proceed reliably

### Analyze Feedback

Separate true course corrections from noise or already-resolved feedback:
1. Review `<pr-context.threads>` for open, unresolved conversations
2. Check `<pr-context.reviews>` for state changes (CHANGES_REQUESTED, etc.)
3. Prioritize critical issues (bugs, security, broken contracts)
4. Identify which files need changes

Do not blindly follow every suggestion—some may lead you off course.

### Implement Fixes

1. Fix critical navigation issues first
2. Follow existing code patterns and conventions
3. Make focused, minimal changes
4. When maintaining your current heading despite a suggestion, be prepared to explain why
5. Store the modified-file count as `<changes-count>`

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
- Otherwise, this approval step is mandatory before any commit, push, or PR reply:
  - Present the implemented fix summary, changed file count, and validation results
  - Ask exactly one `question` with:
    - header `Review Fixes`
    - question `Do these PR fixes look good to commit, push, and respond on the PR?`
    - options:
      - `Go Ahead` - commit, push, and respond to the PR now
      - `Revise` - update the fix based on user feedback before committing
  - Keep custom answers enabled so the user can provide concrete feedback
- Normalize the answer into one of these paths:
  - `Go Ahead` => continue to `### Commit And Push Updates`
  - `Revise` or custom feedback => store the feedback as `<review-feedback>`, then continue to `### Apply Review Feedback`
- Repeat this approval step until the user selects `Go Ahead`
- If the `question` tool is unavailable while `<execution-mode>` is `review`, STOP and report that approval is required before commit, push, or PR replies

### Apply Review Feedback

- Use `<review-feedback>` to refine the implementation without widening scope unless the feedback explicitly asks for it
- Return to `### Implement Fixes`, then rerun validation and the approval step

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
kompass_pr_sync refUrl="<pr-context.pr.url>" commentBody="<reply-text>"

# Reply to a specific review thread (use comment.id from threads.comments)
kompass_pr_sync refUrl="<pr-context.pr.url>" replies=[{"inReplyTo": <comment-id>, "body": "<reply-text>"}]

# Follow-up inline review comment on a specific line
kompass_pr_sync refUrl="<pr-context.pr.url>" commitId="<commit-sha>" review={"comments": [{"path": "<file-path>", "line": <line-number>, "body": "<reply-text>"}]}
```

Confirm which feedback was addressed and which was intentionally not followed.
- Store the number of resolved threads as `<threads-resolved>`

## Additional Context

Use `<additional-context>` when prioritizing which review feedback to address first and when deciding how much scope to take on in this pass.
- Default `/pr/fix` behavior is review-first: show the proposed fix, gather feedback, and loop until the user approves before committing, pushing, or replying on the PR.
- Treat `/pr/fix auto` as the explicit opt-in to skip the approval loop and proceed directly from passing validation to commit, push, and PR replies.
- When the PR context includes relevant attachments, use them as part of the fix brief and response context.

## Output

When waiting for approval or revision feedback, display:
```
Review fixes for PR #<pr-context.pr.number>

- Changes made: <changes-count> files modified
- Validation passing: <validation-passing>
- Validation details: <validation-results>
```

When fixes are complete, display exactly this final completion summary and stop. Do not continue with extra analysis, planning, or follow-up tasks unless the workflow is blocked or the user asked for more:
```
PR fix complete for #<pr-context.pr.number>

- Status: complete, no additional steps needed
- Changes made: <changes-count> files modified
- Threads resolved: <threads-resolved>
- Validation passing: <validation-passing>
- Validation details: <validation-results>
- Pushed: <pushed>
```