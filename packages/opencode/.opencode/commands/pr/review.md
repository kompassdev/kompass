---
description: Review the current PR and publish review feedback
agent: reviewer
---

## Goal

Review a GitHub pull request and publish findings as a formal review with inline comments.

## Workflow

### Interpret Arguments

Store `$ARGUMENTS` as `<arguments>`:
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

Use `<pr-context.pr.commitCount>` as `<depth-hint>`.

Call `kompass_changes_load` with:
- `base: <pr-context.pr.baseRefName>`
- `head: <pr-context.pr.headRefName>`
- `depthHint: <depth-hint>`

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

Derive `<previous-grade>` from the most recent prior review body by `<pr-context.viewerLogin>` when one is present.

Derive `<body-note>` only when you have review feedback that does not belong in an inline comment.

### Publish Review

If there are no new inline comments and no `<body-note>`:
- If `<previous-grade>` matches the current grade, skip publishing a review entirely
- Otherwise, publish a grade-only review body

Create the review payload inline and pipe it to `gh api`:

```bash
gh api --method POST \
  /repos/{owner}/{repo}/pulls/<pr-context.pr.number>/reviews \
  --input - <<'EOF'
{
  "commit_id": "<pr-context.pr.headRefOid>",
  "body": "<review-body>",
  "event": "COMMENT",
  "comments": [
    {
      "path": "<file-path>",
      "line": <line-on-right-side>,
      "side": "RIGHT",
      "body": "<comment-text>"
    }
  ]
}
EOF
```

Set `<review-body>` using these rules:
- If there are inline comments and no non-inline feedback, use only the grade
- If there are inline comments and `<body-note>` exists, use `<grade>\n\n<body-note>`
- If there are no inline comments and the grade changed, use only the grade
- If there are no inline comments, no `<body-note>`, and the grade did not change, skip submission

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

## Additional Context

Use `<ticket-context>` and `<additional-context>` to judge whether the PR meets its stated intent without over-indexing on stylistic preferences.

## Output

When the review is published, display:
```
Review submitted for PR #<pr-context.pr.number>

<details>
- Grade: <star-rating>
- Review URL: <review-url>
```

If the review is skipped because the grade did not change and there was no new feedback, display:
```
Review skipped for PR #<pr-context.pr.number>

<details>
- Grade unchanged: <star-rating>
- Reason: no new inline comments or non-inline feedback
```