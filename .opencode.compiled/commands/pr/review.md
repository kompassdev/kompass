---
description: Review the current PR and publish review feedback
agent: reviewer
---

## Goal

Review a GitHub pull request and publish findings as a formal review with inline comments.

## Workflow

1. **Load PR Context**: 
   - Call `pr_load` with `reviews`, `issueComments`, and `threads` enabled
   - This loads PR metadata, prior reviews, comments, thread state, and your reviewer identity
   - Interpret $ARGUMENTS as an optional PR number or URL

2. **Load Ticket Context**: If the PR body links to exactly one clear ticket, call `ticket_load` for additional context

3. **Load Changes**: Call `changes_load` with `base=pr.baseRefName`, `head=pr.headOid`, and appropriate flags to get the changed-file set and diffs

4. **Review Changes**:
   - Check `AGENTS.md` guidance for changed file paths
   - Read every changed file individually (not just diff context)
   - Look for:
     - Accidental behavior changes
     - Incorrect assumptions (null, empty, retry, timeout, ordering, permissions)
     - Contract breakage (API shapes, return values, schemas, renamed exports)
     - Partial updates across dependent paths
     - Stale references from deleted/renamed files
     - Risky generated/lockfile churn hiding real changes

5. **Generate Review**:
   - Overall grade formatted as `★★☆☆☆` (1-5 stars)
   - Short overall verdict
   - Concise list of findings ordered by impact (critical, high, medium, low)
   - Only high-confidence, actionable findings
   - Explicit mention when no material issues found

6. **Publish Review**:
   - Use `gh api` to POST to `/repos/{repo}/pulls/{pr}/reviews`
   - Include actionable inline comments only
   - Use `pr_load.viewerLogin` to avoid duplicating your own prior comments
   - Create JSON payload and submit with `gh api --method POST ... --input <file>`

## Review Guidelines

- Report findings only when you can name the likely failure mode
- Follow `AGENTS.md` strictly for convention decisions
- Don't report style/naming/cleanup unless it masks a real defect
- Be concise—if it takes more than a few sentences, reconsider
- Skip generated, lockfile, or bulk-format churn unless meaningful