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

Use `pr_load` as the source of truth for PR selection:
- If `<pr-ref>` is defined, call `pr_load` with `pr: <pr-ref>`
- Otherwise, call `pr_load` with no arguments
- Do not run separate git or GitHub commands just to discover which PR to review before calling `pr_load`

Store the result as `<pr-context>`.

### Load Ticket Context

If `<pr-context.pr.body>` links to exactly one clear ticket:
- Call `ticket_load` with the ticket reference
- Store the result as `<ticket-context>` for consideration during review

### Load Changes

Call `changes_load` with `base: <pr-context.pr.baseRefName>`, `head: <pr-context.pr.headRefName>`, and `depthHint: <pr-context.pr.commitCount>` only when it is a positive integer. Store as `<changes>`.

### Review Changes

Following the reviewer agent guidance:
1. Read every changed file for full context before finalizing findings
2. Check `<pr-context.reviews>`, `<pr-context.issueComments>`, and `<pr-context.threads>`
3. Prefer inline comments for file-specific findings; use the review body only for high-level summaries
4. Use diff hunks in `<changes>` to map inline comments to the correct lines
5. Do NOT duplicate findings already raised

Derive `<previous-grade>` from prior reviews and `<already-approved>` from existing approvals on `<pr-context.pr.headRefOid>`.

Before publishing, derive: `<has-inline-comments>`, `<has-body-note>`, `<publish-grade>`, and `<grade-changed>`.

**Grading and Publishing Rules:**
1. Assign a grade based on code quality (1-5 stars)
2. If grade is below `★★★★★` without supporting feedback (inline comments or body note), you MUST add feedback - never publish a low grade without explaining why
<% if (it.approve !== false) { %>
3. **NEVER post a review with `★★★★★`** - if the final grade is 5 stars, approve the PR instead
<% } else { %>
3. If the final grade is `★★★★★`, publish it as review feedback instead of approving the PR
<% } %>
4. If there are issues (grade < 5 stars), create inline comments on specific lines

**Inline comment format:**
```json
{"path": "file.ts", "line": 123, "body": "Issue description"}
```

For multi-line: add `startLine`. For deleted lines: use `side: "LEFT"`.

**Important:** Inline comments ONLY work on changed lines (in diff hunks from `<changes>`). Put feedback on unchanged lines in `review.body` (e.g., "file.ts:216 - issue description").

### Publish Review

<% if (it.approve !== false) { %>
**If `<publish-grade>` is `★★★★★`:**
- Already approved → skip
- Otherwise → `pr_sync` with `refUrl: <pr-context.pr.url>` and only `review.approve: true`
<% } else { %>
**If `<publish-grade>` is `★★★★★`:**
- Pass `refUrl: <pr-context.pr.url>`
- `review.body`: `★★★★★` plus any optional positive summary notes
- Do not pass `review.approve`
- Do not pass any other fields
<% } %>

**If `<publish-grade>` < `★★★★★`:**
- Pass `refUrl: <pr-context.pr.url>`
- `review.body`: grade + notes (unchanged lines, general concerns)
- `review.comments`: inline comments (changed lines only) - **skip lines that already have comments in `<pr-context.threads>`**
- Do not pass any other fields

If `pr_sync` returns a review URL, store it as `<review-url>`.

## Additional Context

Use `<ticket-context>` and `<additional-context>` to judge whether the PR meets its stated intent without over-indexing on stylistic preferences.

## Output

<% if (it.approve !== false) { %>
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
<% } %>

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
