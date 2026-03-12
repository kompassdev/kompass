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

Call `kompass_changes_load` with `base: <pr-context.pr.baseRefName>`, `head: <pr-context.pr.headRefName>`, and `depthHint: <pr-context.pr.commitCount>` only when it is a positive integer. Store as `<changes>`.

### Review Changes

Following the reviewer agent guidance:
1. Read every changed file for full context before finalizing findings
2. Check `<pr-context.reviews>`, `<pr-context.issueComments>`, and `<pr-context.threads>` for ALL existing comments - don't duplicate findings already raised by anyone
3. Prefer inline comments for file-specific findings; use the review body only for high-level summaries
4. Use diff hunks in `<changes>` to map inline comments to the correct lines

Derive `<previous-grade>` from prior reviews and `<already-approved>` from existing approvals on `<pr-context.pr.headRefOid>`.

Before publishing, derive: `<has-inline-comments>`, `<has-body-note>`, `<publish-grade>`, and `<grade-changed>`.

**Grading and Publishing Rules:**
1. Assign a grade based on code quality (1-5 stars)
2. If grade is below `★★★★★` without supporting feedback (inline comments or body note), you MUST add feedback - never publish a low grade without explaining why
3. **NEVER post a review with `★★★★★`** - if the final grade is 5 stars, approve the PR instead
4. If there are issues (grade < 5 stars), create inline comments on specific lines

**Inline comment format:**
```json
{"path": "file.ts", "line": 123, "body": "Issue description"}
```

For multi-line: add `startLine`: `{"path": "file.ts", "line": 125, "startLine": 120, "body": "..."}`

Use `side: "LEFT"` for deleted files or removed lines.

### Publish Review

**If `<publish-grade>` is `★★★★★` (no issues found):**
- If already approved → skip
- Otherwise → call `kompass_pr_sync` with `review.approve: true`

**If `<publish-grade>` is below `★★★★★` (issues found):**
- MUST have supporting feedback (inline comments or body note explaining the issues)
- Call `kompass_pr_sync` with:
  - `review.body`: grade + optional note for issues that CANNOT be mapped to specific lines (general rules, side effects, architectural concerns)
  - `review.comments`: inline comments for EVERY issue that maps to a specific file/line
  - `commitId` when there are inline comments

**Body note usage:** Only use the review body note for feedback that doesn't map to a specific changed line:
- General architectural concerns
- Side effects or impact on other parts of the codebase
- Process/policy violations (e.g., "Missing tests for new features")
- Issues in unchanged files that are affected by these changes
- All other findings MUST be inline comments on the specific lines

If `kompass_pr_sync` returns a review URL, store it as `<review-url>`.

## Additional Context

Use `<ticket-context>` and `<additional-context>` to judge whether the PR meets its stated intent without over-indexing on stylistic preferences.

## Output

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

When review published (grade < 5 stars with feedback):
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