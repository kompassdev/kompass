## Goal

Independently assess PR feedback and CI failures, implement valid fixes, push them, and respond to each current concern.

## Additional Context

Use `<additional-context>` to prioritize feedback and scope. Default behavior requires review; `auto` explicitly skips approval.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- Store automatic completion requests as `<execution-mode>` = `auto`; otherwise use `review`
- Store a PR number or URL as `<pr-ref>` and remaining guidance as `<additional-context>`
- Leave `<pr-ref>` undefined when absent
- Initialize `<handled-feedback-ids>` as an empty set

### Load PR Context

<%~ include("@load-pr", { config: it.config, ref: "<pr-ref>", result: "<pr-context>" }) %>

<%~ include("@pr-branch-update") %>

<%~ include("@pr-fix", { config: it.config, auto: false }) %>

### Output

When `<fix-status>` is `complete`, display:
```
PR fix complete for #<pr-context.pr.number>

- Changes made: <changes-count> files modified
- Base update: <base-update>
- Feedback actionable: <feedback-actionable>
- Feedback declined: <feedback-declined>
- Replies posted: <feedback-replies-posted>
- Validation passing: <validation-passing>
- Validation details: <validation-results>
- Pushed: <pushed>

No additional steps are required.
```

When `<fix-status>` is `waiting for clarification`, display:
```
PR fix waiting for clarification for #<pr-context.pr.number>

- Changes made: <changes-count> files modified
- Feedback declined: <feedback-declined>
- Feedback awaiting clarification: <feedback-awaiting-clarification>
- Replies posted: <feedback-replies-posted>
- Pushed: <pushed>
```
