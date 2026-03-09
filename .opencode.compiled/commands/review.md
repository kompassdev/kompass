---
description: Review branch changes without publishing comments
agent: reviewer
---

## Goal

Review code changes and provide actionable feedback with a grade and risk assessment.

## Workflow

1. **Determine Review Scope** based on $ARGUMENTS:
   - **No arguments**: Call `changes_load` without base/head. It auto-detects:
     - Uncommitted changes present → Review uncommitted changes only
     - Clean worktree → Review current branch vs default base branch
   - **"uncommitted"**: Call `changes_load` without base/head to force uncommitted changes review
   - **Branch name** (e.g., "main", "origin/main"): Call `changes_load` with explicit `base` argument

2. **Review Changes**:
   - Read the changed files and understand the modifications
   - Identify patterns, conventions, and potential issues
   - Look for bugs, security issues, performance problems, and style violations

3. **Generate Review** with:
   - Overall grade formatted as `★★☆☆☆` (1-5 stars)
   - Short verdict on merge risk
   - Concise list of high-confidence findings ordered by impact
   - Explicit mention when no material issues were found
   - Concise wording - only findings you are sure about

4. **Return Result**: Output the review as chat text (do not publish PR comments)

## Review Guidelines

- Focus on correctness, security, and maintainability
- Be specific about issues and provide clear rationale
- Suggest concrete improvements when possible
- Balance thoroughness with conciseness