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
- If empty, leave `<pr-ref>` undefined and let `pr_load` resolve the default PR context

### Load PR Context

<%~ include("@load-pr", { ref: "<pr-ref>", result: "<pr-context>" }) %>

### Load Ticket Context

If `<pr-context.pr.body>` links to exactly one clear ticket:
- Store that reference as `<ticket-ref>`
<%~ include("@load-ticket", { source: "<ticket-ref>", result: "<ticket-context>", comments: true }) %>
- Use `<ticket-context>` for consideration during review

### Load Changes

Call `changes_load` with `base: <pr-context.pr.baseRefName>`, `head: <pr-context.pr.headRefName>`, and `depthHint: <pr-context.pr.commitCount>` only when it is a positive integer. Store as `<changes>`.

### Review Changes

Following the reviewer agent guidance:
1. Read every changed file for full context before finalizing findings
2. Check `<pr-context.reviews>`, `<pr-context.issueComments>`, and `<pr-context.threads>`
3. Derive `<settled-threads>` from `<pr-context.threads>`:
   - Treat resolved threads as settled
   - Treat threads as settled when they already contain feedback from `<pr-context.viewerLogin>` and a later reply from another participant makes it clear the suggestion was intentionally declined, deferred, or answered without a code change request
   - Only revive a settled thread when the new diff adds concrete evidence that the underlying concern is still a material bug, security issue, or broken contract
4. Prefer inline comments for file-specific findings; use the review body only for high-level summaries
5. Use diff hunks in `<changes>` to map inline comments to the correct lines
6. Do NOT duplicate findings already raised or settled

Derive `<previous-grade>` from prior reviews.
<% if (it.config.shared.prApprove === true) { -%>
Derive `<already-approved>` from existing approvals on `<pr-context.pr.headRefOid>`.
<% } -%>

Before publishing, derive: `<has-inline-comments>`, `<has-body-note>`, `<publish-grade>`, and `<grade-changed>`.

**Grading and Publishing Rules:**
1. Assign a grade based on code quality (1-5 stars)
2. If grade is below `★★★★★` without supporting feedback (inline comments or body note), you MUST add feedback - never publish a low grade without explaining why
<% if (it.config.shared.prApprove === true) { -%>
3. **NEVER post a review with `★★★★★`** - if the final grade is 5 stars, approve the PR instead
<% } else { -%>
3. If the final grade is `★★★★★`, publish it as review feedback with `★★★★★` at the start of `review.body`
<% } -%>
4. If there are issues (grade < 5 stars), create inline comments on specific lines

**Inline comment format:**
```json
{"path": "file.ts", "line": 123, "body": "Issue description"}
```

For multi-line: add `startLine`. For deleted lines: use `side: "LEFT"`.

**Important:** Inline comments ONLY work on changed lines (in diff hunks from `<changes>`). Put feedback on unchanged lines in `review.body` (e.g., "file.ts:216 - issue description").

### Publish Review

**If `<publish-grade>` is `★★★★★`:**
<% if (it.config.shared.prApprove === true) { -%>
- Already approved → skip
- Otherwise → `pr_sync` with `refUrl: <pr-context.pr.url>` and only `review.approve: true`
<% } else { -%>
- `pr_sync` with `refUrl: <pr-context.pr.url>` and `review.body` starting with `★★★★★`
- If there are no positive summary notes, the body must be exactly `★★★★★`
- Do not pass `review.comments`
<% } %>
**If `<publish-grade>` is below `★★★★★`:**
- Call `pr_sync` with:
  - `refUrl: <pr-context.pr.url>`
  - `review.body`: the grade line first (for example `★★★☆☆`), followed by any non-inline notes
  - `review.comments`: inline comments (changed lines only) - **skip lines or concerns already covered by open or settled threads in `<pr-context.threads>` unless the new diff introduces a materially different failure mode**
- Never omit the grade from `review.body` in this branch
- Do not pass any other fields

If `pr_sync` returns a review URL, store it as `<review-url>`.

## Additional Context

Use `<ticket-context>` and `<additional-context>` to judge whether the PR meets its stated intent without over-indexing on stylistic preferences.
- When the PR itself includes relevant attachments, use them to understand expected behavior, UX evidence, or bug reproduction details.
- When a linked ticket includes attachments, use them to verify the PR matches the actual request, bug report, or design evidence.

## Output
<% if (it.config.shared.prApprove === true) { -%>
When approved:
```
PR approved for #<pr-context.pr.number>

- PR URL: <pr-context.pr.url>
```

When approval skipped (already approved):
```
Approval skipped for PR #<pr-context.pr.number>

- Reason: current head already approved
```
<% } -%>
When review published:
```
Review submitted for PR #<pr-context.pr.number>

- Grade: <publish-grade>
- Review URL: <review-url>
```

When review skipped (no new feedback):
```
Review skipped for PR #<pr-context.pr.number>

- Reason: no new inline comments or feedback
```
