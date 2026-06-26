---
description: Watch PR CI and comments, repeatedly fixing both without approval prompts
agent: navigator
---

## Goal

Continuously watch a pull request, fix CI failures and PR feedback, commit, push, reply, and repeat until the PR is clean.

## Additional Context

Use `<additional-context>` to constrain which feedback should be handled, how aggressive the fix pass should be, or which CI checks matter when the PR has optional checks.
- This command is intentionally non-interactive: do not ask for approval before delegated fix work, commits, pushes, or PR replies.
- CI failures are part of the loop: capture them as actionable work, fix them, push, then watch CI again.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- If `<arguments>` looks like a PR number or URL, store it as `<pr-ref>`
- If `<arguments>` includes extra fix guidance, CI guidance, or scope constraints, store it as `<additional-context>`
- If empty, leave `<pr-ref>` undefined and let `kompass_pr_load` resolve the default PR context
- Initialize `<completed-fix-passes>` as `0`

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
- STOP if `<pr-url>` or `<pr-number>` is unavailable

### Watch CI And Comments

- Run `gh pr checks <pr-number> --watch` to wait for the latest PR checks to finish
- If the command exits successfully, store `<ci-status>` as `green`
- If there are no checks configured for the PR, store `<ci-status>` as `no checks`
- If the command reports failing, cancelled, timed out, missing, or inconclusive checks, store `<ci-status>` with that state and capture the failing check names, URLs, and failure output as `<ci-failures>`
- Do not STOP only because CI failed; failed checks are actionable feedback for this loop

### Reload PR Feedback

Call `kompass_pr_load` with `<pr-url>` and store the refreshed result as `<fresh-pr-context>`.

- Review `<fresh-pr-context.threads>`, `<fresh-pr-context.reviews>`, and `<fresh-pr-context.issueComments>`
- Identify open, unresolved, actionable reviewer feedback that has not already been answered by the author or superseded by later commits
- Combine actionable reviewer feedback and `<ci-failures>` into `<actionable-work>`
- Store the number of actionable reviewer items as `<actionable-feedback-count>`
- Store the number of actionable CI failures as `<actionable-ci-count>`
- If `<actionable-feedback-count>` and `<actionable-ci-count>` are both `0`, continue to `### Output`

### Delegate Fix Pass

<delegate agent="worker" command="pr/fix">
auto <pr-url>

Fix all actionable PR review feedback and CI failures from the latest loop pass.
CI status: <ci-status>
CI failures: <ci-failures>
Actionable work: <actionable-work>
Additional context: <additional-context>
</delegate>

- Store the delegated result as `<fix-result>`
- If `<fix-result>` is blocked, incomplete, reports failing validation, or reports that push or PR replies failed, STOP and report the fix blocker
- If `<fix-result>` reports that no changes were made for actionable work, STOP and report that manual follow-up is needed to avoid looping on unchanged CI or feedback
- Otherwise, increment `<completed-fix-passes>` by `1` and return to `### Load PR Context`

### Output

If stopped by a delegated fix blocker, display:
```
PR loop blocked for #<pr-number>

- CI status: <ci-status>
- Fix passes completed: <completed-fix-passes>
- Blocker: <fix-result>

No additional steps are required.
```

When complete, display:
```
PR loop complete for #<pr-number>

- CI status: <ci-status>
- CI failures remaining: 0
- Actionable feedback remaining: 0
- Fix passes completed: <completed-fix-passes>

No additional steps are required.
```
