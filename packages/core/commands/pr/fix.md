## Goal

Address feedback or CI failures on a pull request, validate the fixes, push them, and respond.

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

### Load PR Context

<%~ include("@load-pr", { config: it.config, ref: "<pr-ref>", result: "<pr-context>" }) %>

<%~ include("@pr-branch-update") %>

<%~ include("@pr-fix", { config: it.config, auto: false }) %>

### Output

When fixes are complete, display:
```
PR fix complete for #<pr-context.pr.number>

- Changes made: <changes-count> files modified
- Base update: <base-update>
- Threads resolved: <threads-resolved>
- Validation passing: <validation-passing>
- Validation details: <validation-results>
- Pushed: <pushed>

No additional steps are required.
```
