## Goal

Create a pull request for the current branch from its committed changes.

## Additional Context

Use `<additional-context>` when writing the PR. Include `Ticket`, `Description`, and `Checklist` sections in that order, and use `SKIPPED` when ticket mention is skipped.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- Store a branch reference as `<base>`
- Store ticket auto-creation as `<ticket-mode>` = `auto`, an explicit ticket reference as `<ticket-url>`, or an explicit skip as `<ticket-mode>` = `skip`
- Store remaining guidance as `<additional-context>`

### Load And Analyze Changes

<%~ include("@change-summary", { config: it.config, rules: "- If `<base>` is defined, pass it as `base`; otherwise call the tool with no parameters\n- Never pass `uncommitted: true`" }) %>
- Store the result as `<changes>`

<%~ include("@pr-create", { config: it.config }) %>

### Output

When complete, display:
```
Created PR: <pr-title>

URL: <pr-url>
Branch: <current-branch> -> <resolved-base>
Ticket: <ticket-url>
Push: <push-status>

No additional steps are required.
```

If `<pr-existing>` is true, replace the first line with `PR already exists`.
