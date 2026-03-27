---
description: Review the current PR and publish review feedback
agent: reviewer
---

## Goal

Review a GitHub pull request and publish findings as a formal review with inline comments.

## Additional Context

Use `<ticket-context>` and `<additional-context>` to judge whether the PR meets its stated intent without over-indexing on stylistic preferences.

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

- Use `kompass_pr_load` as the source of truth for PR selection
- If `<pr-ref>` is defined, call `kompass_pr_load` with `pr: <pr-ref>`
- Otherwise, call `kompass_pr_load` with no arguments
- Do not run separate git or GitHub commands just to discover the PR before calling `kompass_pr_load`
- Store the result as `<pr-context>`
- Treat the loaded PR body, discussion, review history, and any attachments or linked artifacts returned by the loader as part of the source context
- Review attached images, screenshots, videos, PDFs, and other linked files whenever they can affect the requested fix, review outcome, reproduction steps, or acceptance criteria
- If any relevant attachment cannot be accessed, note that gap and continue only when the remaining PR context is still sufficient to proceed reliably

### Load Ticket Context

If `<pr-context.pr.body>` links to exactly one clear ticket:
- Store that reference as `<ticket-ref>`
- Use `kompass_ticket_load` with `source: <ticket-ref>` and `comments: true`
- Store the result as `<ticket-context>`
- Treat the loaded ticket body, discussion, and any attachments or linked artifacts returned by the loader as part of the source context
- Review attached images, PDFs, and other linked files whenever they can affect requirements, acceptance criteria, reproduction steps, design direction, or the requested answer
- If any relevant attachment cannot be accessed, note that gap and continue only when the remaining ticket context is still sufficient to proceed reliably
- Use `<ticket-context>` for consideration during review

### Load Changes

Call `kompass_changes_load` with `base: <pr-context.pr.baseRefName>`, `head: <pr-context.pr.headRefName>`, and `depthHint: <pr-context.pr.commitCount>` only when it is a positive integer. Store as `<changes>`.

### Review Changes

Following the reviewer agent guidance:
1. Check `<pr-context.reviews>`, `<pr-context.issueComments>`, and `<pr-context.threads>`
2. Derive `<settled-threads>` from `<pr-context.threads>`:
   - Treat resolved threads as settled
   - Treat threads as settled when they already contain feedback from `<pr-context.viewerLogin>` and a later reply makes it clear the concern was intentionally declined, deferred, or answered without a code change request
   - Treat threads as settled when the author's reply directly answers the concern and the current diff does not add a materially different failure mode
3. Derive `<prior-review-baseline>` from `<pr-context.reviews>` authored by `<pr-context.viewerLogin>`
4. Use diff hunks in `<changes>` to map inline comments to the correct lines
5. Derive `<eligible-findings>` as findings that are:
   - new in this diff
   - from a previously unreviewed changed area
   - clearly missed material defects with a concrete failure mode
   Exclude anything already covered by `<settled-threads>` or `<prior-review-baseline>` on the same effective diff.


Derive `<already-approved>` from existing approvals on `<pr-context.pr.headRefOid>`.


Before publishing, derive: `<has-inline-comments>`, `<has-body-note>`, `<publish-grade>`, and whether each proposed finding is included in `<eligible-findings>`.

**Grading and Publishing Rules:**
1. Assign a grade based on code quality (1-5 stars)
2. If grade is below `★★★★★` without supporting feedback (inline comments or body note), you MUST add feedback - never publish a low grade without explaining why
3. If the final grade is `★★★★★`, try to approve the PR instead of posting a 5-star review comment
4. If that approval attempt fails for any reason, immediately fall back to a review with `review.body` starting with `★★★★★`
5. If there are issues (grade < 5 stars), create inline comments on specific lines

**Inline comment format:**
```json
{"path": "file.ts", "line": 123, "body": "Issue description"}
```

For multi-line: add `startLine`. For deleted lines: use `side: "LEFT"`.

**Important:** Inline comments ONLY work on changed lines (in diff hunks from `<changes>`). Put feedback on unchanged lines in `review.body` (e.g., "file.ts:216 - issue description").

### Publish Review

**If `<publish-grade>` is `★★★★★`:**
- Already approved → skip
- Otherwise → first call `kompass_pr_sync` with `refUrl: <pr-context.pr.url>` and only `review.approve: true`
- If that approval call fails, immediately call `kompass_pr_sync` again with `refUrl: <pr-context.pr.url>` and `review.body` starting with `★★★★★`
- If there are no positive summary notes for the fallback review, the fallback body must be exactly `★★★★★`
- Do not pass `review.comments` in the approval attempt or the fallback review

**If `<publish-grade>` is below `★★★★★`:**
- Call `kompass_pr_sync` with:
  - `refUrl: <pr-context.pr.url>`
  - `review.body`: the grade line first (for example `★★★☆☆`), followed by any non-inline notes
  - `review.comments`: inline comments (changed lines only) - **skip lines or concerns already covered by open threads in `<pr-context.threads>` unless the new diff introduces a materially different failure mode**
  - Include only findings from `<eligible-findings>`
- Never omit the grade from `review.body` in this branch
- Do not pass any other fields

If `kompass_pr_sync` returns a review URL, store it as `<review-url>`.

### Output

When approved:
```
PR approved for #<pr-context.pr.number>

- PR URL: <pr-context.pr.url>

No additional steps are required.
```

When approval skipped (already approved):
```
Approval skipped for PR #<pr-context.pr.number>

- Reason: current head already approved

No additional steps are required.
```
When review published:
```
Review submitted for PR #<pr-context.pr.number>

- Grade: <publish-grade>
- Review URL: <review-url>

No additional steps are required.
```

When review skipped (no new feedback):
```
Review skipped for PR #<pr-context.pr.number>

- Reason: no new inline comments or feedback

No additional steps are required.
```
