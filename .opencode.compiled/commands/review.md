---
description: Review branch changes without publishing comments
agent: reviewer
---

## Determining What to Review

Interpret `$ARGUMENTS` to determine which type of review to perform:

1. **No arguments (default)**: Call `changes_load` without base/head arguments. It will auto-detect:
   - If there are uncommitted changes → Review uncommitted local changes only
   - If worktree is clean → Review current branch delta vs default base branch (typically "main")

2. **"uncommitted"** → Call `changes_load` without base/head to force review of uncommitted local changes only

3. **Branch name** (e.g., "main", "origin/main") → Call `changes_load` with explicit `base` argument to compare current branch to that base

Do not publish PR comments.

Return a chat review with:
- an overall grade formatted like `★★☆☆☆`
- a short verdict on merge risk
- a concise list of high-confidence findings ordered by impact
- explicit mention when no material issues were found
- concise wording and only findings you are sure about

## Code Review Navigation Guide

When reviewing code, optimize for high-signal findings per token.

### Workflow
1. Start with a thin loader: use `changes_load` for git-based change inspection
2. Check `AGENTS.md` guidance before reviewing behavior or conventions; when changed files live under nested directories, use the most specific nested `AGENTS.md` that governs that path
3. Scan the summary first so you know the scope, file states, commit history, and where the risk clusters are
4. Use `changes_load` to get the changed-file set and structured per-file diffs
5. When `changes_load` is called without explicit base/head, a dirty worktree should return only uncommitted local changes; otherwise it should return the committed branch delta against the default base branch
6. Read every changed file individually before finalizing the review so you have full file context, not just diff context
7. Use the diff to prioritize and navigate, but do not treat diff hunks alone as sufficient context for a finding
8. Read the full current file for added, modified, renamed, copied, or untracked files before making a claim. For deleted files, inspect the previous file contents from git
9. After reading each changed file once, follow related code only when it is necessary to confirm behavior, prove a regression, or verify compliance with project guidance
10. In CI or shallow clones, prefer `changes_load` with explicit base and head refs so it can fetch only the history it needs

### Efficient Expansion
- Use the loader output to decide reading order, not whether a changed file gets read at all
- Prefer `changes_load` structured per-file diffs first, then read each changed file in full
- Read only the files that are likely to contain the root cause, not every downstream caller
- Skip generated, lockfile, or bulk-format churn unless it hides a meaningful source change nearby
- After you have read each changed file, stop expanding unless a real concern depends on more context

### What To Look For
- behavior that changed accidentally, not just code that looks unusual
- incorrect assumptions about null, empty, default, retry, timeout, ordering, and permission paths
- caller and contract breakage: API shapes, return values, schema changes, renamed exports, moved files, and config semantics
- partial updates: code path changed in one place but not in another dependent path
- deleted or renamed files that leave stale references, docs, routes, imports, migrations, or tests behind
- risky generated or lockfile churn that may hide a real source change nearby

### Finding Threshold
- Report a finding only when you can name the likely failure mode.
- Report a convention or workflow violation only when it conflicts with the applicable `AGENTS.md` guidance.
- Do not report style, naming, or minor cleanup unless it masks a real defect.
- If something looks suspicious but unproven, call it out as a question only when the workflow asks for a chat summary; do not publish speculative inline comments.
- Be concise; if a point is not important enough to state in a few direct sentences, it probably should not be a finding.

### Importance Guide
- `critical`: data loss, security exposure, broken deploy or migration, severe customer impact
- `high`: likely bug or regression in normal usage, broken contract, missing validation on an important path
- `medium`: edge-case bug, incomplete handling, or maintainability issue likely to cause follow-up breakage
- `low`: useful but non-blocking improvement; avoid publishing these unless they are still worth interrupting the author for

### Output Rules
- Be certain before flagging a hazard
- Prefer a small number of high-confidence findings—mark the dangers, not every ripple
- Follow `AGENTS.md` and nested `AGENTS.md` guidance strictly when deciding whether something is compliant
- When reporting a grade, format it as stars like `★★☆☆☆`
- Present the survey clearly in chat with a star grade, a short overall verdict, and a concise finding list ordered by impact