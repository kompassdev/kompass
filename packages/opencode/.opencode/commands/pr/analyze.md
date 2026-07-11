---
description: Load and filter PR review history into an actionable brief
agent: reviewer
---

## Goal

Load a pull request's full review history, filter out resolved and outdated threads, and return a compact actionable brief so the caller never receives stale or already-addressed feedback in its context.

## Additional Context

Use `<additional-context>` to focus the analysis on specific feedback categories, reviewer priorities, or CI concerns that should influence which threads are flagged as actionable.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- If `<arguments>` looks like a PR number (e.g., "123") or URL, store it as `<pr-ref>`
- If `<arguments>` includes extra analysis guidance, scope constraints, or priorities, store it as `<additional-context>`
- If empty, leave `<pr-ref>` undefined and let `kompass_pr_load` resolve the default PR context

### Load PR Context

- Use `kompass_pr_load` as the source of truth for PR selection
- If `<pr-ref>` is defined, call `kompass_pr_load` with `pr: <pr-ref>`
- Otherwise, call `kompass_pr_load` with no arguments
- Do not run separate git or GitHub commands just to discover the PR before calling `kompass_pr_load`
- Store the result as `<pr-context>`
- Store the PR head branch as `<pr-branch>` from `<pr-context>.pr.headRefName` when it is available
- Run `git branch --show-current` and store the trimmed result as `<current-branch>` when it is available
- Run `git rev-parse HEAD` and store the trimmed result as `<current-head>` when it is available
- Treat the loaded PR body, discussion, review history, and any attachments or linked artifacts returned by the loader as part of the source context
- Review attached images, screenshots, videos, PDFs, and other linked files whenever they can affect the requested fix, review outcome, reproduction steps, or acceptance criteria
- If any relevant attachment cannot be accessed, note that gap and continue only when the remaining PR context is still sufficient to proceed reliably

- Store `<pr-url>` as `<pr-context.pr.url>`
- Store `<pr-number>` as `<pr-context.pr.number>`
- Store `<pr-branch>` as `<pr-context.pr.headRefName>`
- Store `<base-branch>` as `<pr-context.pr.baseRefName>`
- Store `<commit-count>` as `<pr-context.pr.commitCount>`
- STOP if `<pr-url>` or `<pr-number>` is unavailable

### Filter Resolved Threads

- Exclude every thread in `<pr-context.threads>` where `isResolved` is `true`
- Exclude every thread where `isOutdated` is `true`
- For each remaining thread, check whether the latest reply from the PR author indicates the feedback was already addressed (phrases like "Fixed", "Done", "Addressed") and a later commit in `<pr-context.pr.commits>` plausibly implements that fix
- Move effectively-resolved threads to a `<resolved-silently>` list with a one-line reason
- Store the remaining threads as `<actionable-threads>`

### Categorize Threads

For each thread in `<actionable-threads>`:
- Classify as `critical`, `important`, `style`, `question`, or `noise`
- Record `<comment-id>`, `<file>`, `<lines>`, `<category>`, `<suggestion>` (one-line), `<current-heading>` (`yes` or `no`)
- Threads marked `noise` or `question` go to the `<not-fixing>` list with reasons

### Partition Groups

- Group actionable threads (`critical`, `important`, actionable `style`) into file-disjoint groups for parallel implementation
- Threads sharing the same file or having cross-thread dependencies stay in the same group
- Store the partition as `<groups>`

### Output

Return a single fenced markdown block with this structure:

```
PR_NUMBER: <pr-number>
PR_BRANCH: <pr-branch>
BASE_BRANCH: <base-branch>
PR_URL: <pr-url>
COMMIT_COUNT: <commit-count>

SUMMARY:
- One-line overall assessment
- Recommended fix order: critical first, then important, then style
- Total actionable threads: <count>
- Total resolved-silently threads: <count>

THREADS:
- [critical] <comment-id> <file>:<lines> - <suggestion> (current-heading: yes/no)
- [important] <comment-id> <file>:<lines> - <suggestion> (current-heading: yes/no)
- [style] <comment-id> <file>:<lines> - <suggestion> (current-heading: yes/no)

NOT_FIXING:
- [noise] <comment-id> - <reason>
- [question] <comment-id> - <reason>

RESOLVED_SILENTLY:
- <comment-id> - <reason>

GROUPS:
- group-1: <file-a>, <file-b>
- group-2: <file-c>
```

If no actionable threads remain, output:
```
PR_NUMBER: <pr-number>
PR_BRANCH: <pr-branch>
BASE_BRANCH: <base-branch>
PR_URL: <pr-url>
COMMIT_COUNT: <commit-count>

SUMMARY:
- No actionable feedback remaining
- Total actionable threads: 0

No additional steps are required.
```
