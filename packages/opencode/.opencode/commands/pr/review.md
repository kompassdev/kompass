---
description: Review the current PR and publish review feedback
agent: reviewer
---

## Goal

Review a GitHub pull request and publish findings as a formal review with inline comments.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- If `<arguments>` looks like a PR number (e.g., "123") or URL, store it as `<pr-ref>`
- If `<arguments>` includes review focus areas, related tickets, or special concerns, store it as `<additional-context>`
- If empty, leave `<pr-ref>` undefined and let `kompass_pr_load` resolve the default PR context

### Load PR Context

Use `kompass_pr_load` as the source of truth for PR selection:
- If `<pr-ref>` is defined, call `kompass_pr_load` with `pr: <pr-ref>`
- Otherwise, call `kompass_pr_load` with no arguments
- Do not run separate git or GitHub commands just to discover which PR to review before calling `kompass_pr_load`

Store the result as `<pr-context>`.

### Load Ticket Context

If `<pr-context.pr.body>` links to exactly one clear ticket:
- Call `kompass_ticket_load` with the ticket reference
- Store the result as `<ticket-context>` for consideration during review

### Load Changes

Use `<pr-context.pr.commitCount>` as `<depth-hint>` only when it is a known positive integer.

Depth hint rules:
- If `<pr-context.pr.commitCount>` is missing, zero, negative, non-integer, or otherwise invalid, omit `depthHint` entirely
- Never negate, offset, estimate, or invent `depthHint` values
- If the exact count is not available, prefer no `depthHint` over a guessed one

Call `kompass_changes_load` with:
- `base: <pr-context.pr.baseRefName>`
- `head: <pr-context.pr.headRefName>`
- `depthHint: <depth-hint>` only when `<depth-hint>` is defined

Store as `<changes>`.

### Review Changes

Following the reviewer agent guidance:
1. Read every changed file for full context in the current session before finalizing findings
2. Inspect `<pr-context.reviews>`, `<pr-context.issueComments>`, and `<pr-context.threads>` for anything already posted by `<pr-context.viewerLogin>`
3. Do not repeat the same finding when an equivalent unresolved or already-submitted comment exists
4. Prefer inline comments for file-specific findings; use the review body only for anything that cannot be expressed inline
5. Do not guess GitHub diff anchors from absolute file line numbers alone; use the diff hunks in `<changes>` to map any inline comment to the changed side of the patch

While reading files:
- Load relevant nested `AGENTS.md` files in the current session before applying review criteria
- For deleted files, inspect the previous contents from git rather than assuming `kompass_changes_load` included the full file
- Use a helper agent only if the changed-file set is too large to review comfortably in one session after the changed paths are already known
- After reading the changed files and any directly relevant `AGENTS.md`, stop expanding unless a specific finding needs confirmation
- Do not inspect unrelated tool implementations, callers, or config paths just to gain confidence when the changed files already answer the question

Derive `<previous-grade>` from the most recent prior review body by `<pr-context.viewerLogin>` when one is present.

Derive `<already-approved>` from whether `<pr-context.viewerLogin>` already has an `APPROVED` review on `<pr-context.pr.headRefOid>`.

Derive `<body-note>` only when you have review feedback that does not belong in an inline comment.

Before publishing, derive:
- `<has-inline-comments>` from whether the review payload would contain any inline comments
- `<has-body-note>` from whether `<body-note>` exists
- `<has-supporting-feedback>` from whether `<has-inline-comments>` or `<has-body-note>` is true
- `<publish-grade>` as the current grade when `<has-supporting-feedback>` is true; otherwise set it to `★★★★★`
- `<should-approve>` from whether `<has-supporting-feedback>` is false and `<publish-grade>` is `★★★★★`
- `<grade-changed>` from whether `<previous-grade>` differs from `<publish-grade>`

Never publish a review below `★★★★★` unless it includes at least one inline comment or a non-inline body note.
If the generated grade is below `★★★★★` without supporting feedback, raise the published grade to `★★★★★` before applying skip logic.

### Publish Review

If `<should-approve>` is true and `<already-approved>` is true:
- Stop immediately
- Do not call `kompass_pr_sync`
- Return the approval-skip output

If `<should-approve>` is true:
- Call `kompass_pr_sync` with `refUrl: <pr-context.pr.url>` and `approve: true`
- Do not publish a review body or inline comments
- Return the approval output

If `<has-supporting-feedback>` is false and `<grade-changed>` is false:
- Stop immediately
- Do not publish review feedback
- Return the skip output

Otherwise, call `kompass_pr_sync` with:
- `refUrl: <pr-context.pr.url>`
- `review.event: "COMMENT"`
- `review.commitId: <pr-context.pr.headRefOid>` when there are inline comments
- `review.body: <review-body>` when `<review-body>` exists
- `review.comments` set to the inline findings when there are inline comments

Set `<review-body>` using these rules:
- If there are inline comments and no non-inline feedback, use only `<publish-grade>`
- If there are inline comments and `<body-note>` exists, use `<publish-grade>\n\n<body-note>`
- If there are no inline comments and `<body-note>` exists, use `<publish-grade>\n\n<body-note>`
- If there are no inline comments, no `<body-note>`, and `<publish-grade>` did not change, skip submission

**Single-line comments**: Use `line` and `side: "RIGHT"`

**Multi-line comments**: Add `start_line`, `line`, `start_side`, and `side`:
```json
{
  "path": "<file-path>",
  "body": "<comment-text>",
  "start_side": "RIGHT",
  "side": "RIGHT",
  "start_line": <start-line>,
  "line": <end-line>
}
```

If the file is deleted or the finding points at removed lines, anchor to the left side of the diff instead of the right side.

Include only actionable inline comments. Prefer posting a precise comment over restating it in the review body.

If `kompass_pr_sync` returns a review URL, store it as `<review-url>`.

## Additional Context

Use `<ticket-context>` and `<additional-context>` to judge whether the PR meets its stated intent without over-indexing on stylistic preferences.

## Output

These formats display results to the user after completing the Publish Review step:

When the PR is approved without comments, display:
```
PR approved for #<pr-context.pr.number>

- Grade: ★★★★★
- PR URL: <pr-context.pr.url>
```

If approval is skipped because the current head is already approved and there is no new feedback, display:
```
Approval skipped for PR #<pr-context.pr.number>

- Grade unchanged: ★★★★★
- Reason: current head already approved and there is no new feedback
```

When the review is published, display:
```
Review submitted for PR #<pr-context.pr.number>

- Grade: <publish-grade>
- Review URL: <review-url>
```

If the review is skipped because the grade did not change and there was no new feedback, display:
```
Review skipped for PR #<pr-context.pr.number>

- Grade unchanged: <publish-grade>
- Reason: no new inline comments or non-inline feedback
```