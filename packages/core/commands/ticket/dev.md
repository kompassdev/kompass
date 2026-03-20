## Goal

Implement a ticket by orchestrating development, branching, commit-and-push, and PR creation.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- Interpret `<arguments>` as `<ticket-source>` (ticket reference, URL, file path, or raw request)
- If `<arguments>` includes extra delivery guidance, scope constraints, or notes, store them as `<additional-context>`
- If `<ticket-source>` is empty, derive it from the conversation before continuing

### Load Ticket Context

<%~ include("@load-ticket", { source: "<ticket-source>", result: "<ticket-context>" }) %>
- Store the ticket reference for PR creation as `<ticket-ref>` by preferring the original reference, otherwise using the canonical ticket URL from `<ticket-context>` when one is available, otherwise using `SKIPPED`
- Store a concise ticket summary as `<ticket-summary>`
- If `<ticket-context>` cannot be loaded, STOP and report that the ticket source is missing or invalid

<%~ include("@dev-flow") %>

### Delegate Implementation

- Before delegating, send the exact dispatch block below

<dispatch agent="general">
/dev
Ticket reference: <ticket-ref>
Ticket context: <ticket-context>
Additional context: <additional-context>
</dispatch>

- Store the result as `<implementation-result>`
- If `<implementation-result>` is blocked or incomplete, STOP and report the implementation blocker

### Delegate Branch Creation

- Before delegating, send the exact dispatch block below

<dispatch agent="general">
/branch
Branch naming guidance: <ticket-summary>
Additional context: <additional-context>
</dispatch>

- Store the result as `<branch-result>`
- If `<branch-result>` is blocked or incomplete, STOP and report the branch blocker
- If `<branch-result>` says branching was skipped because the current branch already looks like a work branch, continue

### Delegate Commit And Push

- Before delegating, send the exact dispatch block below

<dispatch agent="general">
/commit-and-push
Ticket reference: <ticket-ref>
Ticket summary: <ticket-summary>
Additional context: <additional-context>
</dispatch>

- Store the result as `<commit-result>`
- If `<commit-result>` is blocked or incomplete, STOP and report the commit or push blocker
- If `<commit-result>` says there was nothing to commit or push, continue to PR creation so already-committed branch work can still be shipped

### Delegate PR Creation

- Before delegating, send the exact dispatch block below

<dispatch agent="general">
/pr/create
Ticket reference: <ticket-ref>
Ticket context: <ticket-context>
Additional context: <additional-context>
</dispatch>

- Store the result as `<pr-result>`
- If `<pr-result>` is blocked or incomplete, STOP and report the PR blocker
- Otherwise, continue and store the resulting PR URL as `<pr-url>`

## Additional Context

Use `<additional-context>` to refine scope, sequencing, and tradeoffs across the delegated `/dev`, `/branch`, `/commit-and-push`, and `/pr/create` steps.

## Output

When the ticket work is complete, display:
```
Implemented ticket: <ticket-summary>

Implementation: <implementation-result>
Branch: <branch-result>
Commit and push: <commit-result>
PR: <pr-url>

No additional steps are required.
```
